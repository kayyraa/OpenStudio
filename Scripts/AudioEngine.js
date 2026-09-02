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
        this.Compressor = null;
        this.Limiter = null;
        this.MaxVoices = 256;
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
        this.MetronomeEnabled = false;
        this.MetronomeVolume = 0.7;
        this.MetronomeBus = null;
        this.MetroSources = [];
        this.PreRollEnabled = false;
        this.PreRollBeats = 4;
        this.ScheduledStepKeys = new Set();
        this.StepScheduleEpoch = 0;
        this.MasterEqLow = null;
        this.MasterEqMid = null;
        this.MasterEqHigh = null;
    }

    EnsureCtx() {
        if (!this.Ctx) {
            this.Ctx = new (window.AudioContext || window.webkitAudioContext)();

            this.Master = this.Ctx.createGain();
            this.Master.gain.value = 0.85;

            this.MetronomeBus = this.Ctx.createGain();
            this.MetronomeBus.gain.value = this.MetronomeEnabled ? (this.MetronomeVolume != null ? this.MetronomeVolume : 0.7) : 0;

            this.Filter = this.Ctx.createBiquadFilter();
            this.Filter.type = "lowpass";
            this.Filter.frequency.value = this.FilterFreq;
            this.Filter.Q.value = 0.7;

            this.Compressor = this.Ctx.createDynamicsCompressor();
            this.Compressor.threshold.value = -18;
            this.Compressor.knee.value = 12;
            this.Compressor.ratio.value = 4;
            this.Compressor.attack.value = 0.005;
            this.Compressor.release.value = 0.18;

            this.Limiter = this.Ctx.createDynamicsCompressor();
            this.Limiter.threshold.value = -3;
            this.Limiter.knee.value = 0;
            this.Limiter.ratio.value = 20;
            this.Limiter.attack.value = 0.001;
            this.Limiter.release.value = 0.08;

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
            this.Filter.connect(this.Compressor);
            this.Compressor.connect(this.Limiter);
            this.Limiter.connect(this.Analyser);
            this.Analyser.connect(this.Ctx.destination);

            this.MetronomeBus.connect(this.Ctx.destination);

            this.Filter.connect(this.Delay);
            this.Delay.connect(this.DelayFeedback);
            this.DelayFeedback.connect(this.Delay);
            this.Delay.connect(this.DelayGain);
            this.DelayGain.connect(this.Limiter);

            this.Filter.connect(this.Convolver);
            this.Convolver.connect(this.ReverbGain);
            this.ReverbGain.connect(this.Limiter);
        }

        if (this.Ctx.state === "suspended") {
            this.Ctx.resume();
        }

        return this.Ctx;
    }

    EnsureMetronomeBus() {
        this.EnsureCtx();
        if (!this.MetronomeBus) {
            this.MetronomeBus = this.Ctx.createGain();
            this.MetronomeBus.connect(this.Ctx.destination);
        }
        this.ApplyMetronomeGain();
        return this.MetronomeBus;
    }

    ApplyMetronomeGain() {
        if (!this.MetronomeBus || !this.Ctx) return;
        if (this.PreRollActive) return;
        var Target = this.MetronomeEnabled
            ? Math.max(0, Math.min(1, this.MetronomeVolume != null ? this.MetronomeVolume : 0.7))
            : 0;
        try {
            this.MetronomeBus.gain.cancelScheduledValues(this.Ctx.currentTime);
            this.MetronomeBus.gain.setValueAtTime(Target, this.Ctx.currentTime);
        } catch (_) {
            this.MetronomeBus.gain.value = Target;
        }
    }

    SetMetronomeEnabled(On) {
        this.MetronomeEnabled = !!On;
        this.ApplyMetronomeGain();
        if (!this.MetronomeEnabled) {
            this.ClearMetronomeSources();
        }
    }

    SetMetronomeVolume(Vol) {
        this.MetronomeVolume = Math.max(0, Math.min(1, Number(Vol) || 0));
        this.ApplyMetronomeGain();
    }

    ClearMetronomeSources() {
        var Index;
        if (!this.MetroSources) this.MetroSources = [];
        for (Index = 0; Index < this.MetroSources.length; Index++) {
            try { this.MetroSources[Index].stop(0); } catch (_) {}
        }
        this.MetroSources = [];
    }

    PlayMetronomeTick(IsAccent, Time) {
        this.EnsureMetronomeBus();
        var Osc = this.Ctx.createOscillator();
        var Gain = this.Ctx.createGain();
        Osc.type = "sine";
        Osc.frequency.value = IsAccent ? 1200 : 800;
        // Relative tick level; master metro volume is on MetronomeBus so it can hot-change
        var GainValue = IsAccent ? 1 : 0.55;
        var Start = Time || this.Ctx.currentTime;
        Gain.gain.setValueAtTime(GainValue, Start);
        Gain.gain.exponentialRampToValueAtTime(0.0001, Start + 0.05);
        Osc.connect(Gain);
        Gain.connect(this.MetronomeBus);
        Osc.start(Start);
        Osc.stop(Start + 0.06);
        if (!this.MetroSources) this.MetroSources = [];
        this.MetroSources.push(Osc);
        var Self = this;
        Osc.onended = function () {
            var I = Self.MetroSources.indexOf(Osc);
            if (I >= 0) Self.MetroSources.splice(I, 1);
        };
    }

    ScheduleMetronome(SongTimeSeconds, TotalBeats) {
        this.EnsureMetronomeBus();
        this.ClearMetronomeSources();
        if (this.PreRollActive) return;
        this.ApplyMetronomeGain();
        if (!this.MetronomeEnabled || !this.Ctx) return;
        var Now = this.Ctx.currentTime;
        var BeatsCount = TotalBeats || 128;
        var Beat;
        var StartSec;
        var OffsetInSong;
        var When;
        var IsAccent;

        for (Beat = 0; Beat < BeatsCount; Beat++) {
            StartSec = this.BeatsToSeconds(Beat);
            OffsetInSong = StartSec - SongTimeSeconds;
            if (OffsetInSong < -0.05) continue;
            When = Now + OffsetInSong;
            if (When >= Now) {
                IsAccent = (Beat % 4 === 0);
                this.PlayMetronomeTick(IsAccent, When);
            }
        }
    }

    PlayPreRoll(Callback) {
        this.EnsureCtx();
        if (!this.MetronomeBus) {
            this.MetronomeBus = this.Ctx.createGain();
            this.MetronomeBus.connect(this.Ctx.destination);
        }
        var Beats = Math.max(1, Math.min(32, Number(this.PreRollBeats) || 4));
        var BeatSec = 60 / Math.max(1, this.Bpm);
        var Now = this.Ctx.currentTime;
        var Beat;
        var Time;
        var WasEnabled = this.MetronomeEnabled;
        var Vol = Math.max(0.35, this.MetronomeVolume != null ? this.MetronomeVolume : 0.7);
        this.PreRollActive = true;
        // Instant open bus so count-in is always audible
        try {
            this.MetronomeBus.gain.cancelScheduledValues(Now);
            this.MetronomeBus.gain.setValueAtTime(Vol, Now);
        } catch (_) {
            this.MetronomeBus.gain.value = Vol;
        }

        for (Beat = 0; Beat < Beats; Beat++) {
            Time = Now + Beat * BeatSec;
            this.PlayMetronomeTick(Beat === 0 || (Beat % 4 === 0), Time);
        }

        var Self = this;
        setTimeout(function () {
            Self.PreRollActive = false;
            Self.ApplyMetronomeGain();
            if (Callback) Callback();
        }, Math.max(50, BeatSec * Beats * 1000));
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


    PruneSources() {
        var Max = this.MaxVoices || 48;
        if (this.Sources.length <= Max) return;
        var Extra = this.Sources.length - Max;
        var Index;
        for (Index = 0; Index < Extra; Index++) {
            try { this.Sources[Index].stop(); } catch (_) {}
        }
        this.Sources = this.Sources.slice(Extra);
    }

    ConnectWithChannelFx(Source, Gain, Fx) {
        var Node = Source;
        if (Fx) {
            var LowG = Fx.EqLow != null ? Number(Fx.EqLow) : 0;
            var MidG = Fx.EqMid != null ? Number(Fx.EqMid) : 0;
            var HighG = Fx.EqHigh != null ? Number(Fx.EqHigh) : 0;
            if (Math.abs(LowG) > 0.5 || Math.abs(MidG) > 0.5 || Math.abs(HighG) > 0.5) {
                var Low = this.Ctx.createBiquadFilter();
                Low.type = "lowshelf";
                Low.frequency.value = 250;
                Low.gain.value = Math.max(-24, Math.min(24, LowG));
                var Mid = this.Ctx.createBiquadFilter();
                Mid.type = "peaking";
                Mid.frequency.value = 1000;
                Mid.Q.value = 0.9;
                Mid.gain.value = Math.max(-24, Math.min(24, MidG));
                var High = this.Ctx.createBiquadFilter();
                High.type = "highshelf";
                High.frequency.value = 4000;
                High.gain.value = Math.max(-24, Math.min(24, HighG));
                Node.connect(Low);
                Low.connect(Mid);
                Mid.connect(High);
                Node = High;
            }
            var FilterAmt = Fx.Filter != null ? Number(Fx.Filter) / 100 : 1;
            if (FilterAmt < 0.999) {
                var Biquad = this.Ctx.createBiquadFilter();
                Biquad.type = "lowpass";
                Biquad.frequency.value = 40 + Math.pow(Math.max(0, FilterAmt), 2) * 17960;
                Biquad.Q.value = 0.7;
                Node.connect(Biquad);
                Node = Biquad;
            }
            var Drive = Fx.Drive != null ? Number(Fx.Drive) / 100 : 0;
            if (Drive > 0.01) {
                var Shaper = this.Ctx.createWaveShaper();
                var Curve = new Float32Array(256);
                var Amount = 1 + Drive * 12;
                var I;
                for (I = 0; I < 256; I++) {
                    var X = (I * 2) / 255 - 1;
                    Curve[I] = ((Math.PI + Amount) * X) / (Math.PI + Amount * Math.abs(X));
                }
                Shaper.curve = Curve;
                Shaper.oversample = "2x";
                Node.connect(Shaper);
                Node = Shaper;
            }
        }
        Node.connect(Gain);
        var Pan = Fx && Fx.Pan != null ? Number(Fx.Pan) : 0;
        if (this.Ctx.createStereoPanner && Math.abs(Pan) > 0.01) {
            var Panner = this.Ctx.createStereoPanner();
            Panner.pan.value = Math.max(-1, Math.min(1, Pan));
            Gain.connect(Panner);
            Panner.connect(this.Master);
        } else {
            Gain.connect(this.Master);
        }

        if (Fx && this.Delay && this.Convolver) {
            var DelayMix = Fx.Delay != null ? Number(Fx.Delay) / 100 : 0;
            var ReverbMix = Fx.Reverb != null ? Number(Fx.Reverb) / 100 : 0;
            if (DelayMix > 0.01) {
                var Dg = this.Ctx.createGain();
                Dg.gain.value = DelayMix * 0.85;
                Gain.connect(Dg);
                Dg.connect(this.Delay);
            }
            if (ReverbMix > 0.01) {
                var Rg = this.Ctx.createGain();
                Rg.gain.value = ReverbMix * 0.7;
                Gain.connect(Rg);
                Rg.connect(this.Convolver);
            }
        }
    }

    PlayStepSynth(Kind, GainValue, When, Fx) {
        this.EnsureCtx();
        var Start = When != null ? When : this.Ctx.currentTime;
        var Amp = GainValue == null ? 0.85 : GainValue;
        Kind = Kind || "kick";
        var Gain = this.Ctx.createGain();
        var Osc;
        var Noise;
        var I;

        if (Kind === "kick") {
            Osc = this.Ctx.createOscillator();
            Osc.type = "sine";
            Osc.frequency.setValueAtTime(140, Start);
            Osc.frequency.exponentialRampToValueAtTime(40, Start + 0.12);
            Gain.gain.setValueAtTime(Amp, Start);
            Gain.gain.exponentialRampToValueAtTime(0.0001, Start + 0.22);
            this.ConnectWithChannelFx(Osc, Gain, Fx);
            Osc.start(Start);
            Osc.stop(Start + 0.25);
            this.Sources.push(Osc);
        } else if (Kind === "snare") {
            Osc = this.Ctx.createOscillator();
            Osc.type = "triangle";
            Osc.frequency.value = 180;
            var OscGain = this.Ctx.createGain();
            OscGain.gain.setValueAtTime(Amp * 0.35, Start);
            OscGain.gain.exponentialRampToValueAtTime(0.0001, Start + 0.08);
            var BufferSize = Math.floor(this.Ctx.sampleRate * 0.15);
            var Buffer = this.Ctx.createBuffer(1, BufferSize, this.Ctx.sampleRate);
            var Data = Buffer.getChannelData(0);
            for (I = 0; I < BufferSize; I++) Data[I] = Math.random() * 2 - 1;
            Noise = this.Ctx.createBufferSource();
            Noise.buffer = Buffer;
            Gain.gain.setValueAtTime(Amp * 0.7, Start);
            Gain.gain.exponentialRampToValueAtTime(0.0001, Start + 0.12);
            this.ConnectWithChannelFx(Osc, OscGain, Fx);
            this.ConnectWithChannelFx(Noise, Gain, Fx);
            Osc.start(Start);
            Osc.stop(Start + 0.1);
            Noise.start(Start);
            this.Sources.push(Osc);
            this.Sources.push(Noise);
        } else {
            var BufferSize2 = Math.floor(this.Ctx.sampleRate * 0.05);
            var Buffer2 = this.Ctx.createBuffer(1, BufferSize2, this.Ctx.sampleRate);
            var Data2 = Buffer2.getChannelData(0);
            for (I = 0; I < BufferSize2; I++) Data2[I] = Math.random() * 2 - 1;
            Noise = this.Ctx.createBufferSource();
            Noise.buffer = Buffer2;
            var Hp = this.Ctx.createBiquadFilter();
            Hp.type = "highpass";
            Hp.frequency.value = 6000;
            Gain.gain.setValueAtTime(Amp * 0.55, Start);
            Gain.gain.exponentialRampToValueAtTime(0.0001, Start + 0.04);
            Noise.connect(Hp);
            this.ConnectWithChannelFx(Hp, Gain, Fx);
            Noise.start(Start);
            this.Sources.push(Noise);
        }
        this.PruneSources();
    }

    EnsureMasterEq() {
        this.EnsureCtx();
        if (this.MasterEqLow) return;
        this.MasterEqLow = this.Ctx.createBiquadFilter();
        this.MasterEqLow.type = "lowshelf";
        this.MasterEqLow.frequency.value = 250;
        this.MasterEqMid = this.Ctx.createBiquadFilter();
        this.MasterEqMid.type = "peaking";
        this.MasterEqMid.frequency.value = 1000;
        this.MasterEqMid.Q.value = 0.9;
        this.MasterEqHigh = this.Ctx.createBiquadFilter();
        this.MasterEqHigh.type = "highshelf";
        this.MasterEqHigh.frequency.value = 4000;
        try { this.Master.disconnect(); } catch (_) {}
        this.Master.connect(this.MasterEqLow);
        this.MasterEqLow.connect(this.MasterEqMid);
        this.MasterEqMid.connect(this.MasterEqHigh);
        this.MasterEqHigh.connect(this.Filter);
    }

    ApplyMasterEq(Eq) {
        this.EnsureMasterEq();
        Eq = Eq || {};
        this.MasterEqLow.gain.value = Math.max(-24, Math.min(24, Number(Eq.Low) || 0));
        this.MasterEqMid.gain.value = Math.max(-24, Math.min(24, Number(Eq.Mid) || 0));
        this.MasterEqHigh.gain.value = Math.max(-24, Math.min(24, Number(Eq.High) || 0));
    }

    ScheduleClips(Clips, SongTimeSeconds, Options) {
        this.EnsureCtx();
        Options = Options || {};
        if (Options.Clear !== false) {
            this.StopSources();
            this.ScheduledStepKeys = new Set();
            this.StepScheduleEpoch++;
        }

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
            var BaseGain = Clip.Gain == null ? 1 : Clip.Gain;
            var VoiceScale = Math.min(1, 1 / Math.sqrt(Math.max(1, Clips.length * 0.35)));
            Gain.gain.value = BaseGain * VoiceScale;

            this.ConnectWithChannelFx(Source, Gain, Clip.Fx);

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
                this.PruneSources();
            } catch (Error) {
                console.warn("Schedule failed", Error);
            }
        }
    }

    ScheduleSteps(Steps, SongTimeSeconds, Options) {
        this.EnsureCtx();
        Options = Options || {};
        var LookAhead = Options.LookAhead != null ? Options.LookAhead : 8;
        var Now = this.Ctx.currentTime;
        var Index;
        var Step;
        var Buffer;
        var StartSec;
        var OffsetInSong;
        var Source;
        var Gain;
        var When;
        var BaseGain;
        var Scheduled = 0;

        for (Index = 0; Index < Steps.length; Index++) {
            Step = Steps[Index];
            StartSec = this.BeatsToSeconds(Step.Beat);
            OffsetInSong = StartSec - SongTimeSeconds;
            // Only schedule the near future so voices are not pruned away
            if (OffsetInSong < -0.02) continue;
            if (OffsetInSong > LookAhead) continue;

            When = Now + OffsetInSong;
            if (When < Now) When = Now;
            BaseGain = Step.Gain == null ? 0.9 : Step.Gain;

            var Key = String(Math.round(Step.Beat * 1000) / 1000) + "|" + String(Step.Url || Step.Synth || "") + "|" + String(Step.ChannelId || "");
            if (this.ScheduledStepKeys && this.ScheduledStepKeys.has(Key)) continue;
            if (this.ScheduledStepKeys) this.ScheduledStepKeys.add(Key);

            Buffer = Step.Url ? this.Buffers.get(Step.Url) : null;
            if (Buffer) {
                Source = this.Ctx.createBufferSource();
                Source.buffer = Buffer;
                Source.playbackRate.value = Step.PlaybackRate || 1;
                Gain = this.Ctx.createGain();
                Gain.gain.value = BaseGain;
                this.ConnectWithChannelFx(Source, Gain, Step.Fx);
                try {
                    Source.start(When);
                    this.Sources.push(Source);
                    Scheduled++;
                } catch (Error) {
                    console.warn("Step schedule failed", Error);
                }
            } else {
                this.PlayStepSynth(Step.Synth || "kick", BaseGain, When, Step.Fx);
                Scheduled++;
            }
        }
        this.PruneSources();
        return Scheduled;
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
                    var Mime = Self.MicMime || "audio/webm";
                    var BlobData = new Blob(Self.MicChunks, { type: Mime });
                    if (!BlobData.size) {
                        Self.StopMicMonitor();
                        Resolve(null);
                        return;
                    }
                    var ArrayBuffer = await BlobData.arrayBuffer();
                    var Buffer = await Self.Ctx.decodeAudioData(ArrayBuffer.slice(0));
                    Self.StopMicMonitor();
                    Resolve({
                        Buffer: Buffer,
                        Blob: BlobData,
                        Mime: Mime
                    });
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
        var Src;
        for (Index = 0; Index < this.Sources.length; Index++) {
            Src = this.Sources[Index];
            try {
                if (Src.stop) Src.stop(0);
            } catch (_) {}
            try {
                if (Src.disconnect) Src.disconnect();
            } catch (_) {}
        }
        this.Sources = [];
        this.ClearMetronomeSources();
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
