globalThis.PluginRegistry = {};

globalThis.RegisterPlugin = function (Id, Def) {
    PluginRegistry[Id] = Def;
};

RegisterPlugin("sampler", {
    Name: "Sampler",
    Category: "Instrument",
    NeedsSample: true,
    Create: function (Options) {
        return {
            Id: "sampler",
            Name: "Sampler",
            SampleUrl: Options.SampleUrl || "",
            Gain: 1,
            Attack: 0.005,
            Decay: 0.1,
            Sustain: 1,
            Release: 0.15,
            PlaybackRate: 1
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        if (!Plugin.SampleUrl) return null;
        var Buffer = Engine.Buffers.get(Plugin.SampleUrl);
        if (!Buffer) return null;

        Engine.EnsureCtx();
        var Rate = Plugin.PlaybackRate * Math.pow(2, (Note - 60) / 12);
        var Source = Engine.Ctx.createBufferSource();
        Source.buffer = Buffer;
        Source.playbackRate.value = Rate;

        var Gain = Engine.Ctx.createGain();
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 1 : Velocity) * Plugin.Gain;
        Gain.gain.setValueAtTime(0, Now);
        Gain.gain.linearRampToValueAtTime(Vel, Now + Plugin.Attack);
        Gain.gain.linearRampToValueAtTime(Vel * Plugin.Sustain, Now + Plugin.Attack + Plugin.Decay);

        Source.connect(Gain);
        Gain.connect(Engine.Master);
        Source.start();

        return { Source: Source, Gain: Gain, Plugin: Plugin };
    },
    NoteOff: function (Engine, Voice) {
        if (!Voice || !Voice.Gain) return;
        var Now = Engine.Ctx.currentTime;
        var Rel = Voice.Plugin.Release || 0.1;
        Voice.Gain.gain.cancelScheduledValues(Now);
        Voice.Gain.gain.setValueAtTime(Voice.Gain.gain.value, Now);
        Voice.Gain.gain.linearRampToValueAtTime(0, Now + Rel);
        try {
            Voice.Source.stop(Now + Rel + 0.02);
        } catch (_) {}
    }
});

RegisterPlugin("synth", {
    Name: "3x Osc",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return {
            Id: "synth",
            Name: "3x Osc",
            Wave: "sawtooth",
            Gain: 0.55,
            Attack: 0.01,
            Decay: 0.12,
            Sustain: 0.7,
            Release: 0.2,
            Detune: 8,
            FilterHz: 4000,
            Glide: 0.08,
            LastFreq: 0,
            Legato: true
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity, NoteParams) {
        Engine.EnsureCtx();
        NoteParams = NoteParams || {};
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Mix = NoteParams.Mix != null ? NoteParams.Mix : 1;
        var Vel = (Velocity == null ? 1 : Velocity) * Plugin.Gain * Mix;
        var Glide = Math.max(0, NoteParams.Glide != null ? NoteParams.Glide : (Number(Plugin.Glide) || 0));
        var FromFreq = NoteParams.FromFreq != null
            ? NoteParams.FromFreq
            : (Plugin.LastFreq > 0 && Glide > 0 ? Plugin.LastFreq : Freq);
        var FilterHz = NoteParams.FilterHz != null ? NoteParams.FilterHz : Plugin.FilterHz;
        var Resonance = NoteParams.Resonance != null ? NoteParams.Resonance : 1;
        var Pan = NoteParams.Pan != null ? NoteParams.Pan : 0;

        var Filter = Engine.Ctx.createBiquadFilter();
        Filter.type = "lowpass";
        Filter.frequency.value = FilterHz;
        Filter.Q.value = Math.max(0.0001, Resonance);

        var Gain = Engine.Ctx.createGain();
        Gain.gain.setValueAtTime(0, Now);
        Gain.gain.linearRampToValueAtTime(Vel, Now + Plugin.Attack);
        Gain.gain.linearRampToValueAtTime(Vel * Plugin.Sustain, Now + Plugin.Attack + Plugin.Decay);

        // automate along note event points if provided
        if (NoteParams.Events && NoteParams.Events.Mix && NoteParams.DurationSec) {
            var Pts = NoteParams.Events.Mix;
            var Pi;
            for (Pi = 0; Pi < Pts.length; Pi++) {
                var T = Now + Pts[Pi].t * NoteParams.DurationSec;
                var Gv = (Velocity == null ? 1 : Velocity) * Plugin.Gain * Pts[Pi].v;
                Gain.gain.linearRampToValueAtTime(Math.max(0.0001, Gv * Plugin.Sustain), T);
            }
        }
        if (NoteParams.Events && NoteParams.Events.Cutoff && NoteParams.DurationSec) {
            var Cpts = NoteParams.Events.Cutoff;
            var Ci;
            for (Ci = 0; Ci < Cpts.length; Ci++) {
                var Ct = Now + Cpts[Ci].t * NoteParams.DurationSec;
                var Hz = 200 + Math.pow(Cpts[Ci].v, 2) * 12000;
                Filter.frequency.linearRampToValueAtTime(Hz, Ct);
            }
        }

        var Panner = Engine.Ctx.createStereoPanner();
        Panner.pan.value = Math.max(-1, Math.min(1, Pan));

        var Oscs = [];
        var Detunes = [-Plugin.Detune, 0, Plugin.Detune];
        var Index;
        var Osc;

        for (Index = 0; Index < 3; Index++) {
            Osc = Engine.Ctx.createOscillator();
            Osc.type = Plugin.Wave;
            Osc.frequency.setValueAtTime(FromFreq, Now);
            if (FromFreq !== Freq && Glide > 0) {
                Osc.frequency.linearRampToValueAtTime(Freq, Now + Glide);
            } else {
                Osc.frequency.setValueAtTime(Freq, Now);
            }
            Osc.detune.value = Detunes[Index];
            Osc.connect(Filter);
            Osc.start();
            Oscs.push(Osc);
        }

        Plugin.LastFreq = Freq;

        Filter.connect(Gain);
        Gain.connect(Panner);
        Panner.connect(Engine.Master);

        return { Oscs: Oscs, Gain: Gain, Filter: Filter, Panner: Panner, Plugin: Plugin };
    },
    NoteOff: function (Engine, Voice) {
        if (!Voice || !Voice.Gain) return;
        var Now = Engine.Ctx.currentTime;
        var Rel = Voice.Plugin.Release || 0.15;
        Voice.Gain.gain.cancelScheduledValues(Now);
        Voice.Gain.gain.setValueAtTime(Voice.Gain.gain.value, Now);
        Voice.Gain.gain.linearRampToValueAtTime(0, Now + Rel);

        var Index;
        for (Index = 0; Index < Voice.Oscs.length; Index++) {
            try {
                Voice.Oscs[Index].stop(Now + Rel + 0.05);
            } catch (_) {}
        }
    }
});

RegisterPlugin("keys", {
    Name: "Keys",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return {
            Id: "keys",
            Name: "Keys",
            Wave: "triangle",
            Gain: 0.6,
            Attack: 0.002,
            Decay: 0.3,
            Sustain: 0.15,
            Release: 0.4,
            Detune: 0,
            FilterHz: 6000,
            Glide: 0.05,
            LastFreq: 0
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity, NoteParams) {
        return PluginRegistry.synth.NoteOn(Engine, Plugin, Note, Velocity, NoteParams);
    },
    NoteOff: function (Engine, Voice) {
        PluginRegistry.synth.NoteOff(Engine, Voice);
    }
});

RegisterPlugin("bass", {
    Name: "Bass",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return {
            Id: "bass",
            Name: "Bass",
            Wave: "square",
            Gain: 0.65,
            Attack: 0.005,
            Decay: 0.15,
            Sustain: 0.6,
            Release: 0.12,
            Detune: 0,
            FilterHz: 900,
            Glide: 0.12,
            LastFreq: 0
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity, NoteParams) {
        return PluginRegistry.synth.NoteOn(Engine, Plugin, Note - 12, Velocity, NoteParams);
    },
    NoteOff: function (Engine, Voice) {
        PluginRegistry.synth.NoteOff(Engine, Voice);
    }
});

RegisterPlugin("pluck", {
    Name: "Pluck",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return {
            Id: "pluck",
            Name: "Pluck",
            Wave: "sawtooth",
            Gain: 0.55,
            Attack: 0.001,
            Decay: 0.25,
            Sustain: 0.05,
            Release: 0.2,
            Detune: 4,
            FilterHz: 2500,
            Glide: 0.03,
            LastFreq: 0
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity, NoteParams) {
        return PluginRegistry.synth.NoteOn(Engine, Plugin, Note, Velocity, NoteParams);
    },
    NoteOff: function (Engine, Voice) {
        PluginRegistry.synth.NoteOff(Engine, Voice);
    }
});

RegisterPlugin("grand", {
    Name: "Grand Piano",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return {
            Id: "grand",
            Name: "Grand Piano",
            Wave: "triangle",
            Gain: 0.7,
            Attack: 0.002,
            Decay: 0.4,
            Sustain: 0.25,
            Release: 0.55,
            Detune: 3,
            FilterHz: 5500,
            Glide: 0,
            LastFreq: 0
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        Engine.EnsureCtx();
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 1 : Velocity) * Plugin.Gain;
        var Glide = Math.max(0, Number(Plugin.Glide) || 0);
        var FromFreq = Plugin.LastFreq > 0 && Glide > 0 ? Plugin.LastFreq : Freq;

        var Out = Engine.Ctx.createGain();
        Out.gain.setValueAtTime(0, Now);
        Out.gain.linearRampToValueAtTime(Vel, Now + Plugin.Attack);
        Out.gain.linearRampToValueAtTime(Vel * Plugin.Sustain, Now + Plugin.Attack + Plugin.Decay);

        var Harmonics = [1, 2, 3, 4, 5, 6];
        var Gains = [1, 0.45, 0.22, 0.12, 0.07, 0.04];
        var Oscs = [];
        var Index;
        var Osc;
        var Hg;
        var Filter;

        Filter = Engine.Ctx.createBiquadFilter();
        Filter.type = "lowpass";
        Filter.frequency.value = Plugin.FilterHz * (0.6 + Vel * 0.5);
        Filter.Q.value = 0.8;

        for (Index = 0; Index < Harmonics.length; Index++) {
            Osc = Engine.Ctx.createOscillator();
            Osc.type = Index < 2 ? "triangle" : "sine";
            var Target = Freq * Harmonics[Index];
            var From = FromFreq * Harmonics[Index];
            Osc.frequency.setValueAtTime(From, Now);
            if (From !== Target && Glide > 0) {
                Osc.frequency.linearRampToValueAtTime(Target, Now + Glide);
            }
            Osc.detune.value = (Index % 2 === 0 ? -1 : 1) * Plugin.Detune * Index * 0.3;

            Hg = Engine.Ctx.createGain();
            Hg.gain.value = Gains[Index];
            Osc.connect(Hg);
            Hg.connect(Filter);
            Osc.start();
            Oscs.push(Osc);
        }

        Plugin.LastFreq = Freq;

        // soft hammer noise
        var NoiseDur = 0.03;
        var NoiseBuf = Engine.Ctx.createBuffer(1, Engine.Ctx.sampleRate * NoiseDur, Engine.Ctx.sampleRate);
        var Nd = NoiseBuf.getChannelData(0);
        for (Index = 0; Index < Nd.length; Index++) {
            Nd[Index] = (Math.random() * 2 - 1) * Math.exp(-Index / (Nd.length * 0.2));
        }
        var Noise = Engine.Ctx.createBufferSource();
        Noise.buffer = NoiseBuf;
        var Ng = Engine.Ctx.createGain();
        Ng.gain.value = 0.08 * Vel;
        Noise.connect(Ng);
        Ng.connect(Filter);
        Noise.start(Now);

        Filter.connect(Out);
        Out.connect(Engine.Master);

        return { Oscs: Oscs, Gain: Out, Filter: Filter, Plugin: Plugin };
    },
    NoteOff: function (Engine, Voice) {
        if (!Voice || !Voice.Gain) return;
        var Now = Engine.Ctx.currentTime;
        var Rel = Voice.Plugin.Release || 0.4;
        Voice.Gain.gain.cancelScheduledValues(Now);
        Voice.Gain.gain.setValueAtTime(Math.max(0.0001, Voice.Gain.gain.value), Now);
        Voice.Gain.gain.exponentialRampToValueAtTime(0.0001, Now + Rel);
        var Index;
        for (Index = 0; Index < Voice.Oscs.length; Index++) {
            try {
                Voice.Oscs[Index].stop(Now + Rel + 0.05);
            } catch (_) {}
        }
    }
});

RegisterPlugin("epiano", {
    Name: "E-Piano",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return {
            Id: "epiano",
            Name: "E-Piano",
            Wave: "sine",
            Gain: 0.55,
            Attack: 0.005,
            Decay: 0.35,
            Sustain: 0.4,
            Release: 0.35,
            Detune: 6,
            FilterHz: 3200
        };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        return PluginRegistry.grand.NoteOn(Engine, Object.assign({}, Plugin, {
            FilterHz: Plugin.FilterHz,
            Gain: Plugin.Gain
        }), Note, Velocity);
    },
    NoteOff: function (Engine, Voice) {
        PluginRegistry.grand.NoteOff(Engine, Voice);
    }
});