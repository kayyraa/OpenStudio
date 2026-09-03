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


function MakeBasicSynthNoteOn(Defaults) {
    return function (Engine, Plugin, Note, Velocity, NoteParams) {
        Engine.EnsureCtx();
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 0.85 : Velocity) * (Plugin.Gain == null ? 0.5 : Plugin.Gain);
        var Wave = Plugin.Wave || Defaults.Wave || "sawtooth";
        var Osc = Engine.Ctx.createOscillator();
        Osc.type = Wave;
        var Filter = Engine.Ctx.createBiquadFilter();
        Filter.type = "lowpass";
        Filter.frequency.value = Plugin.FilterHz != null ? Plugin.FilterHz : (Defaults.FilterHz || 4000);
        Filter.Q.value = Plugin.Resonance != null ? Plugin.Resonance : 0.8;
        var Out = Engine.Ctx.createGain();
        var Atk = Plugin.Attack != null ? Plugin.Attack : (Defaults.Attack || 0.01);
        var Dec = Plugin.Decay != null ? Plugin.Decay : (Defaults.Decay || 0.12);
        var Sus = Plugin.Sustain != null ? Plugin.Sustain : (Defaults.Sustain || 0.6);
        var Rel = Plugin.Release != null ? Plugin.Release : (Defaults.Release || 0.2);
        Osc.frequency.setValueAtTime(Freq, Now);
        Out.gain.setValueAtTime(0.0001, Now);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel), Now + Math.max(0.005, Atk));
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel * Sus), Now + Math.max(0.005, Atk) + Math.max(0.01, Dec));
        Osc.connect(Filter);
        Filter.connect(Out);
        Out.connect(Engine.Master);
        Osc.start(Now);
        return { Oscs: [Osc], Gain: Out, Filter: Filter, Plugin: Plugin };
    };
}

function MakeBasicSynthNoteOff() {
    return function (Engine, Voice) {
        if (!Voice || !Voice.Gain) return;
        var Now = Engine.Ctx.currentTime;
        var Rel = (Voice.Plugin && Voice.Plugin.Release) || 0.2;
        Voice.Gain.gain.cancelScheduledValues(Now);
        Voice.Gain.gain.setValueAtTime(Math.max(0.0001, Voice.Gain.gain.value), Now);
        Voice.Gain.gain.exponentialRampToValueAtTime(0.0001, Now + Rel);
        if (Voice.Oscs) {
            var I;
            for (I = 0; I < Voice.Oscs.length; I++) {
                try { Voice.Oscs[I].stop(Now + Rel + 0.05); } catch (_) {}
            }
        }
    };
}

RegisterPlugin("organ", {
    Name: "Organ",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return { Id: "organ", Name: "Organ", Wave: "sine", Gain: 0.35, Attack: 0.01, Decay: 0.05, Sustain: 0.9, Release: 0.15, FilterHz: 6000 };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        Engine.EnsureCtx();
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 0.85 : Velocity) * Plugin.Gain;
        var Out = Engine.Ctx.createGain();
        var Oscs = [];
        var Ratios = [1, 2, 3, 4];
        var Gains = [1, 0.5, 0.25, 0.12];
        var I;
        for (I = 0; I < Ratios.length; I++) {
            var Osc = Engine.Ctx.createOscillator();
            Osc.type = "sine";
            Osc.frequency.value = Freq * Ratios[I];
            var G = Engine.Ctx.createGain();
            G.gain.value = Gains[I];
            Osc.connect(G);
            G.connect(Out);
            Osc.start(Now);
            Oscs.push(Osc);
        }
        Out.gain.setValueAtTime(0.0001, Now);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel), Now + Plugin.Attack);
        Out.connect(Engine.Master);
        return { Oscs: Oscs, Gain: Out, Plugin: Plugin };
    },
    NoteOff: MakeBasicSynthNoteOff()
});

RegisterPlugin("pad", {
    Name: "Pad",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return { Id: "pad", Name: "Pad", Wave: "triangle", Gain: 0.28, Attack: 0.4, Decay: 0.5, Sustain: 0.7, Release: 1.2, FilterHz: 1800, Detune: 12 };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        Engine.EnsureCtx();
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 0.85 : Velocity) * Plugin.Gain;
        var Filter = Engine.Ctx.createBiquadFilter();
        Filter.type = "lowpass";
        Filter.frequency.value = Plugin.FilterHz;
        var Out = Engine.Ctx.createGain();
        var Oscs = [];
        var I;
        for (I = 0; I < 3; I++) {
            var Osc = Engine.Ctx.createOscillator();
            Osc.type = Plugin.Wave || "triangle";
            Osc.frequency.value = Freq;
            Osc.detune.value = (I - 1) * (Plugin.Detune || 10);
            Osc.connect(Filter);
            Osc.start(Now);
            Oscs.push(Osc);
        }
        Filter.connect(Out);
        Out.gain.setValueAtTime(0.0001, Now);
        Out.gain.linearRampToValueAtTime(Vel, Now + Plugin.Attack);
        Out.gain.linearRampToValueAtTime(Vel * Plugin.Sustain, Now + Plugin.Attack + Plugin.Decay);
        Out.connect(Engine.Master);
        return { Oscs: Oscs, Gain: Out, Filter: Filter, Plugin: Plugin };
    },
    NoteOff: MakeBasicSynthNoteOff()
});

RegisterPlugin("lead", {
    Name: "Lead",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return { Id: "lead", Name: "Lead", Wave: "sawtooth", Gain: 0.4, Attack: 0.02, Decay: 0.15, Sustain: 0.65, Release: 0.25, FilterHz: 5000 };
    },
    NoteOn: MakeBasicSynthNoteOn({ Wave: "sawtooth", FilterHz: 5000 }),
    NoteOff: MakeBasicSynthNoteOff()
});

RegisterPlugin("bell", {
    Name: "Bell",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return { Id: "bell", Name: "Bell", Wave: "sine", Gain: 0.45, Attack: 0.002, Decay: 1.2, Sustain: 0.15, Release: 0.8, FilterHz: 8000 };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        Engine.EnsureCtx();
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 0.85 : Velocity) * Plugin.Gain;
        var Out = Engine.Ctx.createGain();
        var Oscs = [];
        var Partials = [1, 2.76, 5.4];
        var I;
        for (I = 0; I < Partials.length; I++) {
            var Osc = Engine.Ctx.createOscillator();
            Osc.type = "sine";
            Osc.frequency.value = Freq * Partials[I];
            var G = Engine.Ctx.createGain();
            G.gain.value = 1 / (I + 1);
            Osc.connect(G);
            G.connect(Out);
            Osc.start(Now);
            Oscs.push(Osc);
        }
        Out.gain.setValueAtTime(0.0001, Now);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel), Now + 0.005);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel * 0.15), Now + Plugin.Decay);
        Out.connect(Engine.Master);
        return { Oscs: Oscs, Gain: Out, Plugin: Plugin };
    },
    NoteOff: MakeBasicSynthNoteOff()
});

RegisterPlugin("fm", {
    Name: "FM Keys",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return { Id: "fm", Name: "FM Keys", Wave: "sine", Gain: 0.4, Attack: 0.01, Decay: 0.3, Sustain: 0.4, Release: 0.35, FilterHz: 5000, ModIndex: 120 };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        Engine.EnsureCtx();
        var Freq = 440 * Math.pow(2, (Note - 69) / 12);
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 0.85 : Velocity) * Plugin.Gain;
        var Car = Engine.Ctx.createOscillator();
        var Mod = Engine.Ctx.createOscillator();
        var ModGain = Engine.Ctx.createGain();
        var Out = Engine.Ctx.createGain();
        Car.type = "sine";
        Mod.type = "sine";
        Car.frequency.value = Freq;
        Mod.frequency.value = Freq * 2;
        ModGain.gain.value = Plugin.ModIndex || 120;
        Mod.connect(ModGain);
        ModGain.connect(Car.frequency);
        Car.connect(Out);
        Out.gain.setValueAtTime(0.0001, Now);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel), Now + Plugin.Attack);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel * Plugin.Sustain), Now + Plugin.Attack + Plugin.Decay);
        Out.connect(Engine.Master);
        Mod.start(Now);
        Car.start(Now);
        return { Oscs: [Car, Mod], Gain: Out, Plugin: Plugin };
    },
    NoteOff: MakeBasicSynthNoteOff()
});

RegisterPlugin("noise", {
    Name: "Noise Hit",
    Category: "Instrument",
    NeedsSample: false,
    Create: function () {
        return { Id: "noise", Name: "Noise Hit", Gain: 0.5, Attack: 0.001, Decay: 0.12, Sustain: 0.05, Release: 0.08, FilterHz: 4000 };
    },
    NoteOn: function (Engine, Plugin, Note, Velocity) {
        Engine.EnsureCtx();
        var Now = Engine.Ctx.currentTime;
        var Vel = (Velocity == null ? 0.85 : Velocity) * Plugin.Gain;
        var Dur = 0.25;
        var Buf = Engine.Ctx.createBuffer(1, Engine.Ctx.sampleRate * Dur, Engine.Ctx.sampleRate);
        var Data = Buf.getChannelData(0);
        var I;
        for (I = 0; I < Data.length; I++) Data[I] = Math.random() * 2 - 1;
        var Src = Engine.Ctx.createBufferSource();
        Src.buffer = Buf;
        var Filter = Engine.Ctx.createBiquadFilter();
        Filter.type = "bandpass";
        Filter.frequency.value = 200 + ((Note || 60) / 127) * 6000;
        var Out = Engine.Ctx.createGain();
        Out.gain.setValueAtTime(0.0001, Now);
        Out.gain.exponentialRampToValueAtTime(Math.max(0.0002, Vel), Now + 0.005);
        Out.gain.exponentialRampToValueAtTime(0.0001, Now + Plugin.Decay);
        Src.connect(Filter);
        Filter.connect(Out);
        Out.connect(Engine.Master);
        Src.start(Now);
        return { Source: Src, Gain: Out, Plugin: Plugin };
    },
    NoteOff: function (Engine, Voice) {
        if (!Voice || !Voice.Gain) return;
        var Now = Engine.Ctx.currentTime;
        Voice.Gain.gain.cancelScheduledValues(Now);
        Voice.Gain.gain.setValueAtTime(Math.max(0.0001, Voice.Gain.gain.value), Now);
        Voice.Gain.gain.exponentialRampToValueAtTime(0.0001, Now + 0.05);
    }
});

globalThis.CreateCustomPlugin = function (Spec) {
    Spec = Spec || {};
    var Id = String(Spec.Id || ("custom_" + Date.now())).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    if (!Id) Id = "custom_" + Date.now();
    if (PluginRegistry[Id]) Id = Id + "_" + Date.now();
    var Name = String(Spec.Name || "Custom Synth").slice(0, 40);
    var Def = {
        Name: Name,
        Category: "Custom",
        NeedsSample: false,
        Create: function () {
            return {
                Id: Id,
                Name: Name,
                Wave: Spec.Wave || "sawtooth",
                Gain: Spec.Gain != null ? Spec.Gain : 0.45,
                Attack: Spec.Attack != null ? Spec.Attack : 0.02,
                Decay: Spec.Decay != null ? Spec.Decay : 0.15,
                Sustain: Spec.Sustain != null ? Spec.Sustain : 0.6,
                Release: Spec.Release != null ? Spec.Release : 0.25,
                FilterHz: Spec.FilterHz != null ? Spec.FilterHz : 4000,
                Resonance: Spec.Resonance != null ? Spec.Resonance : 0.8
            };
        },
        NoteOn: MakeBasicSynthNoteOn({ Wave: Spec.Wave || "sawtooth", FilterHz: Spec.FilterHz || 4000 }),
        NoteOff: MakeBasicSynthNoteOff()
    };
    RegisterPlugin(Id, Def);
    return Id;
};