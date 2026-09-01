globalThis.AudioEngine = class {

    constructor() {
        this.Ctx = null;
        this.Master = null;
        this.Filter = null;
        this.Delay = null;
        this.DelayFeedback = null;
        this.DelayGain = null;
        this.ReverbGain = null;
        this.Convolver = null;
        this.Analyser = null;
        this.Buffers = new Map();
        this.Loading = new Map();
        this.Sources = [];
        this.StartCtxTime = 0;
        this.StartSongTime = 0;
        this.Playing = false;
        this.Bpm = 120;
        this.PixelsPerBeat = 48;
        this.FilterFreq = 18000;
        this.DelayMix = 0;
        this.DelayTime = 0.25;
        this.DelayFb = 0.35;
        this.ReverbMix = 0;
        this.MicStream = null;
        this.MicSource = null;
        this.MicRecorder = null;
        this.MicChunks = [];
        this.MicRecording = false;
    }

    EnsureCtx() {
        if (!this.Ctx) {
            this.Ctx = new (window.AudioContext || window.webkitAudioContext)();

            this.Master = this.Ctx.createGain();
            this.Master.gain.value = 1;

            this.Filter = this.Ctx.createBiquadFilter();
            this.Filter.type = "lowpass";
            this.Filter.frequency.value = this.FilterFreq;
            this.Filter.Q.value = 0.7;

            this.Analyser = this.Ctx.createAnalyser();
            this.Analyser.fftSize = 2048;
            this.Analyser.smoothingTimeConstant = 0.7;

            this.Delay = this.Ctx.createDelay(1.0);
            this.Delay.delayTime.value = this.DelayTime;
            this.DelayFeedback = this.Ctx.createGain();
            this.DelayFeedback.gain.value = this.DelayFb;
            this.DelayGain = this.Ctx.createGain();
            this.DelayGain.gain.value = this.DelayMix;

            this.Convolver = this.Ctx.createConvolver();
            this.Convolver.buffer = this.BuildImpulse(1.8);
            this.ReverbGain = this.Ctx.createGain();
            this.ReverbGain.gain.value = this.ReverbMix;

            this.Master.connect(this.Filter);
            this.Filter.connect(this.Analyser);
            this.Analyser.connect(this.Ctx.destination);

            this.Filter.connect(this.Delay);
            this.Delay.connect(this.DelayFeedback);
            this.DelayFeedback.connect(this.Delay);
            this.Delay.connect(this.DelayGain);
            this.DelayGain.connect(this.Ctx.destination);

            this.Filter.connect(this.Convolver);
            this.Convolver.connect(this.ReverbGain);
            this.ReverbGain.connect(this.Ctx.destination);
        }

        if (this.Ctx.state === "suspended") {
            this.Ctx.resume();
        }

        return this.Ctx;
    }

    GetAnalyserData() {
        if (!this.Analyser) return null;
        var Buffer = new Uint8Array(this.Analyser.fftSize);
        this.Analyser.getByteTimeDomainData(Buffer);
        return Buffer;
    }

    GetFrequencyData() {
        if (!this.Analyser) return null;
        var Buffer = new Uint8Array(this.Analyser.frequencyBinCount);
        this.Analyser.getByteFrequencyData(Buffer);
        return Buffer;
    }

    SetBpm(Bpm) {
        this.Bpm = Math.max(1, Number(Bpm) || 120);
    }

    SetFilterFreq(Hz) {
        this.FilterFreq = Math.max(40, Math.min(18000, Number(Hz) || 18000));
        if (this.Filter) {
            this.Filter.frequency.setTargetAtTime(this.FilterFreq, this.Ctx.currentTime, 0.02);
        }
    }

    SetDelayMix(Mix) {
        this.DelayMix = Math.max(0, Math.min(1, Number(Mix) || 0));
        if (this.DelayGain) {
            this.DelayGain.gain.setTargetAtTime(this.DelayMix, this.Ctx.currentTime, 0.02);
        }
    }

    SetDelayTime(Sec) {
        this.DelayTime = Math.max(0.01, Math.min(1, Number(Sec) || 0.25));
        if (this.Delay) {
            this.Delay.delayTime.setTargetAtTime(this.DelayTime, this.Ctx.currentTime, 0.02);
        }
    }

    BuildImpulse(Seconds) {
        var Rate = this.Ctx.sampleRate;
        var Length = Rate * Seconds;
        var Impulse = this.Ctx.createBuffer(2, Length, Rate);
        var Left = Impulse.getChannelData(0);
        var Right = Impulse.getChannelData(1);
        var Index;
        for (Index = 0; Index < Length; Index++) {
            var Decay = Math.pow(1 - Index / Length, 2.5);
            Left[Index] = (Math.random() * 2 - 1) * Decay;
            Right[Index] = (Math.random() * 2 - 1) * Decay;
        }
        return Impulse;
    }

    SetReverbMix(Mix) {
        this.ReverbMix = Math.max(0, Math.min(1, Number(Mix) || 0));
        if (this.ReverbGain) {
            this.ReverbGain.gain.setTargetAtTime(this.ReverbMix, this.Ctx.currentTime, 0.03);
        }
    }

    BeatsToSeconds(Beats) {
        return (Beats * 60) / this.Bpm;
    }

    SecondsToBeats(Sec) {
        return (Sec * this.Bpm) / 60;
    }

    RateForLength(BufferDurationSec, TargetBeats) {
        if (!TargetBeats || TargetBeats <= 0) return 1;
        var NaturalBeats = this.SecondsToBeats(BufferDurationSec);
        if (NaturalBeats <= 0) return 1;
        return NaturalBeats / TargetBeats;
    }

    async LoadSample(Url) {
        if (this.Buffers.has(Url)) {
            return this.Buffers.get(Url);
        }

        if (this.Loading.has(Url)) {
            return this.Loading.get(Url);
        }

        var Self = this;

        var Promise = (async function () {
            Self.EnsureCtx();

            var FetchUrl = Url;

            if (Url.includes("github.com") && Url.includes("blob/") && Url.includes("raw=true")) {
                FetchUrl = Url
                    .replace("https://github.com/", "https://raw.githubusercontent.com/")
                    .replace("/blob/", "/")
                    .replace(/\?raw=true$/, "");
            }

            var Response = await fetch(FetchUrl);

            if (!Response.ok) {
                throw new Error("Failed to load sample: " + Response.status);
            }

            var ArrayBuffer = await Response.arrayBuffer();
            var Buffer = await Self.Ctx.decodeAudioData(ArrayBuffer.slice(0));

            Self.Buffers.set(Url, Buffer);
            Self.Loading.delete(Url);

            return Buffer;
        })().catch(function (Error) {
            Self.Loading.delete(Url);
            throw Error;
        });

        this.Loading.set(Url, Promise);
        return Promise;
    }

    RegisterBuffer(Key, Buffer) {
        this.Buffers.set(Key, Buffer);
    }

    PlayOneShot(Url, GainValue, PlaybackRate) {
        this.EnsureCtx();
        var Buffer = this.Buffers.get(Url);
        if (!Buffer) return;

        var Source = this.Ctx.createBufferSource();
        Source.buffer = Buffer;
        Source.playbackRate.value = PlaybackRate || 1;

        var Gain = this.Ctx.createGain();
        Gain.gain.value = GainValue == null ? 1 : GainValue;

        Source.connect(Gain);
        Gain.connect(this.Master);
        Source.start();
        this.Sources.push(Source);

        var Self = this;
        Source.onended = function () {
            var Index = Self.Sources.indexOf(Source);
            if (Index >= 0) Self.Sources.splice(Index, 1);
        };
    }

    ScheduleClips(Clips, SongTimeSeconds) {
        this.EnsureCtx();
        this.StopSources();

        var Now = this.Ctx.currentTime;

        this.StartCtxTime = Now;
        this.StartSongTime = SongTimeSeconds;
        this.Playing = true;

        var Index;
        var Clip;
        var Buffer;
        var StartSec;
        var OffsetInSong;
        var Source;
        var Gain;
        var When;
        var Offset;
        var MaxDuration;
        var Rate;

        for (Index = 0; Index < Clips.length; Index++) {
            Clip = Clips[Index];
            Buffer = this.Buffers.get(Clip.Url);
            if (!Buffer) continue;

            Rate = Clip.PlaybackRate || 1;
            StartSec = this.BeatsToSeconds(Clip.StartBeat);
            OffsetInSong = StartSec - SongTimeSeconds;

            if (OffsetInSong + (Buffer.duration / Rate) < 0) continue;

            Source = this.Ctx.createBufferSource();
            Source.buffer = Buffer;
            Source.playbackRate.value = Rate;

            Gain = this.Ctx.createGain();
            Gain.gain.value = Clip.Gain == null ? 1 : Clip.Gain;

            Source.connect(Gain);
            Gain.connect(this.Master);

            When = Now + OffsetInSong;
            Offset = 0;

            if (When < Now) {
                Offset = (Now - When) * Rate;
                When = Now;
            }

            MaxDuration = Clip.DurationBeats != null
                ? this.BeatsToSeconds(Clip.DurationBeats)
                : Buffer.duration / Rate;

            try {
                Source.start(When, Offset, Math.max(0, MaxDuration - Offset / Rate));
                this.Sources.push(Source);
            } catch (Error) {
                console.warn("Schedule failed", Error);
            }
        }
    }

    ScheduleSteps(Steps, SongTimeSeconds) {
        this.EnsureCtx();

        var Now = this.Ctx.currentTime;
        var Index;
        var Step;
        var Buffer;
        var StartSec;
        var OffsetInSong;
        var Source;
        var Gain;
        var When;

        for (Index = 0; Index < Steps.length; Index++) {
            Step = Steps[Index];
            Buffer = this.Buffers.get(Step.Url);
            if (!Buffer) continue;

            StartSec = this.BeatsToSeconds(Step.Beat);
            OffsetInSong = StartSec - SongTimeSeconds;
            if (OffsetInSong < -0.05) continue;

            Source = this.Ctx.createBufferSource();
            Source.buffer = Buffer;
            Source.playbackRate.value = Step.PlaybackRate || 1;

            Gain = this.Ctx.createGain();
            Gain.gain.value = Step.Gain == null ? 1 : Step.Gain;

            Source.connect(Gain);
            Gain.connect(this.Master);

            When = Now + OffsetInSong;
            if (When < Now) When = Now;

            try {
                Source.start(When);
                this.Sources.push(Source);
            } catch (Error) {
                console.warn("Step schedule failed", Error);
            }
        }
    }

    async StartMicMonitor() {
        this.EnsureCtx();
        if (this.MicStream) return;

        this.MicStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        this.MicSource = this.Ctx.createMediaStreamSource(this.MicStream);
        this.MicSource.connect(this.Master);
    }

    PickRecorderMime() {
        var Types = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus",
            "audio/mp4",
            ""
        ];
        var Index;
        for (Index = 0; Index < Types.length; Index++) {
            if (!Types[Index]) return "";
            if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(Types[Index])) {
                return Types[Index];
            }
        }
        return "";
    }

    async StartMicCapture() {
        await this.StartMicMonitor();
        this.MicChunks = [];

        var Mime = this.PickRecorderMime();
        var Options = Mime ? { mimeType: Mime } : undefined;

        try {
            this.MicRecorder = Options ? new MediaRecorder(this.MicStream, Options) : new MediaRecorder(this.MicStream);
        } catch (Error) {
            this.MicRecorder = new MediaRecorder(this.MicStream);
        }

        this.MicMime = this.MicRecorder.mimeType || Mime || "audio/webm";
        var Self = this;
        this.MicRecorder.ondataavailable = function (Event) {
            if (Event.data && Event.data.size > 0) {
                Self.MicChunks.push(Event.data);
            }
        };
        this.MicRecorder.start(250);
        this.MicRecording = true;
        this.MicStartCtxTime = this.Ctx.currentTime;
    }

    async StopMicCapture() {
        var Self = this;
        if (!this.MicRecorder || !this.MicRecording) {
            this.StopMicMonitor();
            return null;
        }

        return new Promise(function (Resolve) {
            Self.MicRecorder.onstop = async function () {
                Self.MicRecording = false;
                try {
                    var BlobData = new Blob(Self.MicChunks, { type: Self.MicMime || "audio/webm" });
                    if (!BlobData.size) {
                        Self.StopMicMonitor();
                        Resolve(null);
                        return;
                    }
                    var ArrayBuffer = await BlobData.arrayBuffer();
                    var Buffer = await Self.Ctx.decodeAudioData(ArrayBuffer.slice(0));
                    Self.StopMicMonitor();
                    Resolve(Buffer);
                } catch (Error) {
                    console.warn("Mic decode failed", Error);
                    Self.StopMicMonitor();
                    Resolve(null);
                }
            };
            try {
                if (Self.MicRecorder.state !== "inactive") {
                    Self.MicRecorder.stop();
                } else {
                    Self.StopMicMonitor();
                    Resolve(null);
                }
            } catch (_) {
                Self.StopMicMonitor();
                Resolve(null);
            }
        });
    }

    StopMicMonitor() {
        if (this.MicSource) {
            try { this.MicSource.disconnect(); } catch (_) {}
            this.MicSource = null;
        }
        if (this.MicStream) {
            this.MicStream.getTracks().forEach(function (Track) { Track.stop(); });
            this.MicStream = null;
        }
        this.MicRecorder = null;
        this.MicChunks = [];
        this.MicRecording = false;
    }

    StopSources() {
        var Index;
        for (Index = 0; Index < this.Sources.length; Index++) {
            try {
                this.Sources[Index].stop();
            } catch (_) {}
        }
        this.Sources = [];
        this.Playing = false;
    }

    Stop() {
        this.StopSources();
    }

    GetSongTime() {
        if (!this.Playing || !this.Ctx) {
            return this.StartSongTime;
        }
        return this.StartSongTime + (this.Ctx.currentTime - this.StartCtxTime);
    }

};