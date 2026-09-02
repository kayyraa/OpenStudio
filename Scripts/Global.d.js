var State = {
    User: null,
    Samples: [],
    Projects: [],
    BrowserTab: "samples",
    Channels: [],
    Simulation: {
        Time: 0,
        Playing: false
    },
    TransportGeneration: 0,
    PixelsPerBeat: 48,
    TrackHeight: 64,
    SelectedChannelId: null,
    Drag: null,
    DockResize: null,
    ChannelDrag: null,
    TotalBeats: 256,
    WaveformPeaks: null,
    WaveformSampleUrl: null,
    FollowPlayhead: true,
    ActiveVoices: {},
    PianoOctave: 4,
    Recording: false,
    RecordArm: {},
    SelectedNote: null,
    SelectedNotes: [],
    SelectedClips: [],
    Clipboard: { Notes: [], Clips: [] },
    NoteDrag: null,
    WasPlayingBeforeScrub: false,
    PianoPointerDown: false,
    PianoLastNote: null,
    ProjectId: null,
    HeldKeys: {},
    MouseHolds: {},
    KeyHolds: {},
    MicStartBeat: null,
    LocalBlobs: {},
    Scrubbing: false,
    PianoRoll: {
        Open: false,
        ChannelId: null,
        ScrollMidi: 84,
        PixelsPerBeat: 40,
        RowH: 16,
        LowMidi: 24,
        HighMidi: 96,
        Drag: null,
        EventGraphParam: "Cutoff",
        GraphDrag: null,
        GraphHoverIndex: -1
    }
};

var Engine = new AudioEngine();

var Colors = [
    "#ff6a00",
    "#4a9eff",
    "#5cb85c",
    "#f0ad4e",
    "#9b59b6",
    "#e74c3c",
    "#1abc9c",
    "#e67e22"
];

var TempoInput = null;
var TempoBubble = null;
var TimeLabel = null;
var PlayButton = null;
var StopButton = null;
var ChannelList = null;
var PlaylistBody = null;
var Playlist = null;
var SampleList = null;
var BrowserSearch = null;
var UploadStatus = null;
var SignInButton = null;
var UserChip = null;
var ProfileImg = null;
var DisplayNameLabel = null;
var DockLeft = null;
var DockRight = null;
var DragGhost = null;

var TimelineCanvas = null;
var TimelineCtx = null;
var RulerCanvas = null;
var RulerCtx = null;
var WaveformCanvas = null;
var WaveformCtx = null;

var LastTimestamp = 0;
var FlashTimer = null;
var FlashDurationMs = 64;

function RefreshDomRefs() {
    TempoInput = document.querySelector("input.Tempo");
    TempoBubble = document.querySelector("div.TempoBubble");
    TimeLabel = document.querySelector("span.TimeLabel");
    PlayButton = document.querySelector("img.PlayButton");
    StopButton = document.querySelector("img.StopButton");
    ChannelList = document.querySelector("#ChannelList");
    PlaylistBody = document.querySelector("#PlaylistBody");
    Playlist = document.querySelector("#Playlist");
    SampleList = document.querySelector("#SampleList");
    BrowserSearch = document.querySelector("#BrowserSearch");
    UploadStatus = document.querySelector("#UploadStatus");
    SignInButton = document.querySelector("#SignInButton");
    UserChip = document.querySelector("#UserChip");
    ProfileImg = document.querySelector("#ProfileImg");
    DisplayNameLabel = document.querySelector("#DisplayNameLabel");
    DockLeft = document.querySelector("#DockLeft");
    DockRight = document.querySelector("#DockRight");
    DragGhost = document.querySelector("#DragGhost");

    TimelineCanvas = document.querySelector("#TimelineCanvas");
    RulerCanvas = document.querySelector("#RulerCanvas");
    WaveformCanvas = document.querySelector("#WaveformCanvas");
    TimelineCtx = TimelineCanvas ? TimelineCanvas.getContext("2d") : null;
    RulerCtx = RulerCanvas ? RulerCanvas.getContext("2d") : null;
    WaveformCtx = WaveformCanvas ? WaveformCanvas.getContext("2d") : null;
}

function QueryAll(Selector, Root) {
    return Array.prototype.slice.call((Root || document).querySelectorAll(Selector));
}

function PreloadTransportAssets() {
    var Clips = CollectClips();
    var Steps = CollectSteps();
    var Loads = [];
    var Seen = {};
    var Index;
    var Url;

    for (Index = 0; Index < Clips.length; Index++) {
        Url = Clips[Index].Url;
        if (Url && !Seen[Url]) {
            Seen[Url] = true;
            Loads.push(Engine.LoadSample(Url).catch(function () { return null; }));
        }
    }
    for (Index = 0; Index < Steps.length; Index++) {
        Url = Steps[Index].Url;
        if (Url && !Seen[Url]) {
            Seen[Url] = true;
            Loads.push(Engine.LoadSample(Url).catch(function () { return null; }));
        }
    }

    var ChannelIndex;
    var Channel;
    for (ChannelIndex = 0; ChannelIndex < State.Channels.length; ChannelIndex++) {
        Channel = State.Channels[ChannelIndex];
        if (Channel.SampleUrl && !Seen[Channel.SampleUrl]) {
            Seen[Channel.SampleUrl] = true;
            Loads.push(Engine.LoadSample(Channel.SampleUrl).catch(function () { return null; }));
        }
    }

    return Promise.all(Loads);
}

function ResumeAudio() {
    Engine.EnsureCtx();
    if (Engine.Ctx && Engine.Ctx.state === "suspended") {
        try { Engine.Ctx.resume(); } catch (_) {}
    }
}

function StartPlaybackFromPlayhead() {
    Engine.EnsureCtx();
    ResumeAudio();
    Engine.SetBpm(Number(TempoInput.value) || 120);

    function DoStart() {
        State.TransportGeneration = (State.TransportGeneration || 0) + 1;
        State.Simulation.Playing = true;
        UpdatePlayIcon();
        Engine.ClearMetronomeSources();
        return PreloadTransportAssets().then(function () {
            if (!State.Simulation.Playing) return;
            var SongTime = State.Simulation.Time;
            Engine.ScheduleClips(CollectClips(), SongTime, { Clear: true });
            Engine.ScheduleSteps(CollectSteps(), SongTime, { LookAhead: 8 });
            ScheduleRecordedNotes(SongTime);
            State.LastStepScheduleBeat = Engine.SecondsToBeats(SongTime);
            if (!Engine.PreRollActive) {
                Engine.ScheduleMetronome(SongTime, State.TotalBeats);
            }
            DrawAll();
        });
    }

    if (Engine.PreRollEnabled && !State.Simulation.Playing) {
        Engine.ClearMetronomeSources();
        return new Promise(function (Resolve) {
            Engine.PlayPreRoll(function () {
                Engine.ClearMetronomeSources();
                Engine.PreRollActive = false;
                Engine.ApplyMetronomeGain();
                DoStart().then(Resolve);
            });
        });
    }

    return DoStart();
}

function TogglePlay() {
    if (State.Simulation.Playing) {
        State.Simulation.Time = Engine.GetSongTime();
        if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
        HardStopAllVoices();
        State.Simulation.Playing = false;
        State.Recording = false;
        UpdatePlayIcon();
        UpdateRecordUi();
        DrawAll();
        return;
    }

    StartPlaybackFromPlayhead();
}


function HardStopAllVoices() {
    if (Engine.ScheduledStepKeys) Engine.ScheduledStepKeys = new Set();
    if (Engine.StepScheduleEpoch != null) Engine.StepScheduleEpoch++;
    State.TransportGeneration = (State.TransportGeneration || 0) + 1;
    var Midi;
    var Voice;
    var Def;
    for (Midi in State.ActiveVoices) {
        if (!State.ActiveVoices.hasOwnProperty(Midi)) continue;
        Voice = State.ActiveVoices[Midi];
        try {
            if (Voice.Gain && Voice.Gain.gain) {
                Voice.Gain.gain.cancelScheduledValues(Engine.Ctx ? Engine.Ctx.currentTime : 0);
                Voice.Gain.gain.value = 0;
            }
            if (Voice.Source) {
                try { Voice.Source.stop(0); } catch (_) {}
                try { Voice.Source.disconnect(); } catch (_) {}
            }
            if (Voice.Oscs) {
                var Oi;
                for (Oi = 0; Oi < Voice.Oscs.length; Oi++) {
                    try { Voice.Oscs[Oi].stop(0); } catch (_) {}
                    try { Voice.Oscs[Oi].disconnect(); } catch (_) {}
                }
            }
            Def = Voice.Plugin && PluginRegistry[Voice.Plugin.Id];
            if (Def && Def.NoteOff) {
                try { Def.NoteOff(Engine, Voice); } catch (_) {}
            }
        } catch (_) {}
    }
    State.ActiveVoices = {};
    State.MouseHolds = {};
    State.KeyHolds = {};
    State.HeldKeys = {};
    State.RecordArm = {};
    Engine.Stop();
}

function FinishRecordingSession() {
    State.Recording = false;
    HardStopAllVoices();
    State.Simulation.Playing = false;
    State.Simulation.Time = 0;
    Engine.StartSongTime = 0;
    UpdatePlayIcon();
    UpdateRecordUi();
    DrawAll();
    if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
}

function ToggleRecord() {
    if (State.Recording) {
        FinishRecordingSession();
        return;
    }

    State.Recording = true;
    UpdateRecordUi();

    if (!State.Simulation.Playing) {
        StartPlaybackFromPlayhead();
    }
}

function StopTransport() {
    if (Engine.MicRecording) {
        ToggleMicRecord();
    }
    FinishRecordingSession();
}

function CollectClips() {
    var Out = [];
    var ChannelIndex;
    var ClipIndex;
    var Channel;
    var Clip;
    var Buffer;
    var Rate;

    for (ChannelIndex = 0; ChannelIndex < State.Channels.length; ChannelIndex++) {
        Channel = State.Channels[ChannelIndex];
        if (Channel.Muted) continue;

        Buffer = Engine.Buffers.get(Channel.SampleUrl);

        for (ClipIndex = 0; ClipIndex < Channel.Clips.length; ClipIndex++) {
            Clip = Channel.Clips[ClipIndex];
            Rate = 1;

            if (Channel.StretchToClip && Buffer) {
                Rate = Engine.RateForLength(Buffer.duration, Clip.DurationBeats);
            } else if (Channel.SyncToTempo && Buffer && Channel.SampleBpm) {
                Rate = Engine.Bpm / Channel.SampleBpm;
            }

            Out.push({
                Url: Channel.SampleUrl,
                StartBeat: Clip.StartBeat,
                DurationBeats: Clip.DurationBeats,
                Gain: Channel.Gain == null ? 1 : Channel.Gain,
                PlaybackRate: Rate,
                Fx: Channel.Fx || null
            });
        }
    }

    return Out;
}

function CollectSteps() {
    var Out = [];
    var ChannelIndex;
    var Channel;
    var Step;
    var Bar;
    var Bars;
    var Buffer;
    var Rate;
    var Synth;

    Bars = Math.max(1, Math.ceil(State.TotalBeats / 4));

    for (ChannelIndex = 0; ChannelIndex < State.Channels.length; ChannelIndex++) {
        Channel = State.Channels[ChannelIndex];
        if (Channel.Muted) continue;
        Channel.Pattern = NormalizePattern(Channel.Pattern);
        EnsureChannelFx(Channel);
        var HasStep = false;
        var Si;
        for (Si = 0; Si < 16; Si++) {
            if (Channel.Pattern[Si]) { HasStep = true; break; }
        }
        if (!HasStep) continue;

        Buffer = Channel.SampleUrl ? Engine.Buffers.get(Channel.SampleUrl) : null;
        Rate = 1;
        if (Channel.SyncToTempo && Buffer && Channel.SampleBpm) {
            Rate = Engine.Bpm / Channel.SampleBpm;
        }
        Synth = StepSynthKindForChannel(Channel, ChannelIndex);

        for (Bar = 0; Bar < Bars; Bar++) {
            for (Step = 0; Step < 16; Step++) {
                if (!Channel.Pattern[Step]) continue;
                Out.push({
                    Url: Channel.SampleUrl || "",
                    ChannelId: Channel.Id,
                    Beat: Bar * 4 + Step * 0.25,
                    Gain: Channel.Gain == null ? 1 : Channel.Gain,
                    PlaybackRate: Rate,
                    Fx: Channel.Fx || null,
                    Synth: Synth
                });
            }
        }
    }

    return Out;
}

function CollectNotes() {
    var Out = [];
    var ChannelIndex;
    var Channel;
    var NoteIndex;
    var N;
    var Prev;
    var Sorted;

    for (ChannelIndex = 0; ChannelIndex < State.Channels.length; ChannelIndex++) {
        Channel = State.Channels[ChannelIndex];
        if (Channel.Muted || !Channel.Notes) continue;

        Sorted = Channel.Notes.slice().sort(function (A, B) {
            return (A.Beat || 0) - (B.Beat || 0);
        });

        Prev = null;
        for (NoteIndex = 0; NoteIndex < Sorted.length; NoteIndex++) {
            N = Sorted[NoteIndex];
            Out.push({
                Channel: Channel,
                Note: N.Note,
                NoteObj: N,
                Beat: N.Beat,
                Velocity: N.Velocity,
                DurationBeats: N.DurationBeats || 0.25,
                PrevMidi: Prev
            });
            Prev = N.Note;
        }
    }
    return Out;
}


function SampleEventValue(Points, T) {
    if (!Points || !Points.length) return 0.5;
    if (T <= Points[0].t) return Points[0].v;
    var Index;
    for (Index = 0; Index < Points.length - 1; Index++) {
        if (T >= Points[Index].t && T <= Points[Index + 1].t) {
            var A = Points[Index];
            var B = Points[Index + 1];
            var U = (T - A.t) / Math.max(0.0001, B.t - A.t);
            return A.v + (B.v - A.v) * U;
        }
    }
    return Points[Points.length - 1].v;
}

function BuildNoteParams(N, PrevNoteMidi) {
    EnsureNoteEvents(N);
    var Mix = SampleEventValue(N.Events.Mix, 0);
    var CutV = SampleEventValue(N.Events.Cutoff, 0);
    var ResV = SampleEventValue(N.Events.Resonance, 0);
    var PanV = SampleEventValue(N.Events.Pan, 0);
    var GlideV = SampleEventValue(N.Events.Glide, 0);
    var Params = {
        Mix: Mix,
        FilterHz: 200 + Math.pow(CutV, 2) * 12000,
        Resonance: 0.1 + ResV * 20,
        Pan: PanV * 2 - 1,
        Glide: GlideV * 0.5,
        Events: N.Events,
        DurationSec: Engine.BeatsToSeconds(N.DurationBeats || 0.25)
    };
    if (PrevNoteMidi != null && Params.Glide > 0) {
        Params.FromFreq = 440 * Math.pow(2, (PrevNoteMidi - 69) / 12);
    }
    return Params;
}

function ScheduleRecordedNotes(SongTimeSeconds) {
    var Notes = CollectNotes();
    var Index;
    var Item;
    var StartSec;
    var When;
    var Now;
    var Sorted;

    Engine.EnsureCtx();
    Now = Engine.Ctx.currentTime;

    Sorted = Notes.slice().sort(function (A, B) {
        return A.Beat - B.Beat;
    });

    for (Index = 0; Index < Sorted.length; Index++) {
        Item = Sorted[Index];
        StartSec = Engine.BeatsToSeconds(Item.Beat);
        if (StartSec + 0.05 < SongTimeSeconds) continue;

        When = Now + (StartSec - SongTimeSeconds);
        if (When < Now) When = Now;

        (function (Ch, NoteObj, DelayMs, PrevMidi, Gen) {
            setTimeout(function () {
                if (!State.Simulation.Playing) return;
                if (Gen !== State.TransportGeneration) return;
                var Pl = GetChannelPlugin(Ch);
                if (!Pl) return;
                var D = PluginRegistry[Pl.Id] || PluginRegistry.sampler;
                if (Pl.Id === "sampler" && Pl.SampleUrl && !Engine.Buffers.has(Pl.SampleUrl)) return;

                var Params = BuildNoteParams(NoteObj, PrevMidi);
                var Vel = NoteObj.Velocity == null ? 0.85 : NoteObj.Velocity;
                var V = D.NoteOn(Engine, Pl, NoteObj.Note, Vel, Params);

                if (V) {
                    setTimeout(function () {
                        if (Gen !== State.TransportGeneration) {
                            try {
                                if (V.Gain) V.Gain.gain.value = 0;
                                if (V.Source) V.Source.stop(0);
                                if (V.Oscs) V.Oscs.forEach(function (O) { try { O.stop(0); } catch (_) {} });
                            } catch (_) {}
                            return;
                        }
                        D.NoteOff(Engine, V);
                    }, Math.max(30, Engine.BeatsToSeconds(NoteObj.DurationBeats || 0.25) * 1000));
                }
            }, Math.max(0, DelayMs));
        })(
            Item.Channel,
            Item.NoteObj,
            (When - Now) * 1000,
            Item.PrevMidi,
            State.TransportGeneration
        );
    }
}

function RescheduleTransport() {
    if (!State.Simulation.Playing) return;
    if (!Engine.Ctx) Engine.EnsureCtx();
    ResumeAudio();
    Engine.SetBpm(Number(TempoInput.value) || 120);
    var SongTime = Engine.GetSongTime();
    State.Simulation.Time = SongTime;
    Engine.StartCtxTime = Engine.Ctx.currentTime;
    Engine.StartSongTime = SongTime;
    Engine.Playing = true;
    Engine.ScheduleClips(CollectClips(), SongTime, { Clear: true });
    Engine.ScheduleSteps(CollectSteps(), SongTime, { LookAhead: 8 });
    ScheduleRecordedNotes(SongTime);
    State.LastStepScheduleBeat = Engine.SecondsToBeats(SongTime);
    Engine.ScheduleMetronome(SongTime, State.TotalBeats);
}

function TopUpStepSchedule() {
    if (!State.Simulation.Playing || !Engine.Ctx) return;
    var SongTime = Engine.GetSongTime();
    var Beat = Engine.SecondsToBeats(SongTime);
    if (State.LastStepScheduleBeat == null) State.LastStepScheduleBeat = Beat;
    // Top up every half beat so steps stay scheduled in the look-ahead window
    if (Beat - State.LastStepScheduleBeat < 0.45) return;
    State.LastStepScheduleBeat = Beat;
    Engine.ScheduleSteps(CollectSteps(), SongTime, { LookAhead: 8 });
}

function ExtendTimeline(ExtraBeats) {
    ExtraBeats = ExtraBeats == null ? 64 : Math.max(16, Number(ExtraBeats) || 64);
    State.TotalBeats = Math.min(2048, (State.TotalBeats || 64) + ExtraBeats);
    if (typeof ResizeCanvases === "function") ResizeCanvases();
    if (typeof DrawAll === "function") DrawAll();
}

function EnsureTimelineFitsBeat(Beat) {
    if (Beat == null) return;
    if (Beat + 16 > State.TotalBeats) {
        State.TotalBeats = Math.min(2048, Math.ceil((Beat + 64) / 16) * 16);
        if (typeof ResizeCanvases === "function") ResizeCanvases();
    }
}

function MidiNoteName(Note) {
    var Names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    var N = Math.round(Note);
    return Names[((N % 12) + 12) % 12] + String(Math.floor(N / 12));
}

function NoteLaneY(Midi, TrackY, TrackH) {
    var MinN = 36;
    var MaxN = 96;
    var Clamped = Math.max(MinN, Math.min(MaxN, Midi));
    var Frac = (Clamped - MinN) / (MaxN - MinN);
    var NoteH = Math.max(8, TrackH * 0.22);
    var Top = TrackY + 4;
    var Usable = TrackH - NoteH - 8;
    return Top + (1 - Frac) * Usable;
}

function ClearBulkSelection() {
    State.SelectedNotes = [];
    State.SelectedClips = [];
    State.SelectedNote = null;
}

function NoteKey(ChannelId, Index) {
    return String(ChannelId) + ":" + String(Index);
}

function IsNoteSelected(ChannelId, Index) {
    var Key = NoteKey(ChannelId, Index);
    var I;
    for (I = 0; I < (State.SelectedNotes || []).length; I++) {
        if (State.SelectedNotes[I] === Key) return true;
    }
    return false;
}

function ToggleNoteSelection(ChannelId, Index, Additive) {
    var Key = NoteKey(ChannelId, Index);
    if (!Additive) {
        State.SelectedNotes = [Key];
        State.SelectedClips = [];
        State.SelectedNote = { ChannelId: ChannelId, Index: Index };
        return;
    }
    var Next = [];
    var Found = false;
    var I;
    for (I = 0; I < (State.SelectedNotes || []).length; I++) {
        if (State.SelectedNotes[I] === Key) { Found = true; continue; }
        Next.push(State.SelectedNotes[I]);
    }
    if (!Found) Next.push(Key);
    State.SelectedNotes = Next;
    State.SelectedNote = Next.length ? { ChannelId: ChannelId, Index: Index } : null;
}

function DeleteSelectedTimelineItems() {
    var Changed = false;
    var I;
    var Parts;
    var Channel;
    var Ci;
    var NoteMap = {};

    for (I = 0; I < (State.SelectedNotes || []).length; I++) {
        Parts = String(State.SelectedNotes[I]).split(":");
        if (Parts.length < 2) continue;
        if (!NoteMap[Parts[0]]) NoteMap[Parts[0]] = {};
        NoteMap[Parts[0]][Parts[1]] = true;
    }
    for (Ci = 0; Ci < State.Channels.length; Ci++) {
        Channel = State.Channels[Ci];
        if (!Channel.Notes || !NoteMap[Channel.Id]) continue;
        var Keep = [];
        var Ni;
        for (Ni = 0; Ni < Channel.Notes.length; Ni++) {
            if (!NoteMap[Channel.Id][String(Ni)]) Keep.push(Channel.Notes[Ni]);
            else Changed = true;
        }
        Channel.Notes = Keep;
    }

    for (I = 0; I < (State.SelectedClips || []).length; I++) {
        Parts = String(State.SelectedClips[I]).split(":");
        if (Parts.length < 2) continue;
        for (Ci = 0; Ci < State.Channels.length; Ci++) {
            Channel = State.Channels[Ci];
            if (Channel.Id !== Parts[0]) continue;
            var Cid = Parts[1];
            var NextClips = [];
            var Cj;
            for (Cj = 0; Cj < Channel.Clips.length; Cj++) {
                if (String(Channel.Clips[Cj].Id) !== String(Cid)) NextClips.push(Channel.Clips[Cj]);
                else Changed = true;
            }
            Channel.Clips = NextClips;
        }
    }

    if (Changed) {
        ClearBulkSelection();
        DrawTimeline();
        if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
        if (State.Simulation.Playing) RescheduleTransport();
    }
    return Changed;
}

function ClipKey(ChannelId, ClipId) {
    return String(ChannelId) + ":" + String(ClipId);
}

function IsClipSelected(ChannelId, ClipId) {
    var Key = ClipKey(ChannelId, ClipId);
    var I;
    for (I = 0; I < (State.SelectedClips || []).length; I++) {
        if (State.SelectedClips[I] === Key) return true;
    }
    return false;
}

function ToggleClipSelection(ChannelId, ClipId, Additive) {
    var Key = ClipKey(ChannelId, ClipId);
    if (!Additive) {
        State.SelectedClips = [Key];
        State.SelectedNotes = [];
        State.SelectedNote = null;
        return;
    }
    var Next = [];
    var Found = false;
    var I;
    for (I = 0; I < (State.SelectedClips || []).length; I++) {
        if (State.SelectedClips[I] === Key) { Found = true; continue; }
        Next.push(State.SelectedClips[I]);
    }
    if (!Found) Next.push(Key);
    State.SelectedClips = Next;
}

function DefaultDropDurationBeats(Channel) {
    var Buffer = Channel && Channel.SampleUrl ? Engine.Buffers.get(Channel.SampleUrl) : null;
    var Full = 1;
    if (Buffer) {
        Full = Math.max(0.25, Engine.SecondsToBeats(Buffer.duration));
    }
    // Smaller drops: 1 beat max (or sample length if shorter)
    return Math.min(1, Full);
}

function SnapshotSelectionToClipboard() {
    var Notes = [];
    var Clips = [];
    var I;
    var Parts;
    var Ci;
    var Channel;
    var MinBeat = null;

    function TrackMin(B) {
        if (MinBeat == null || B < MinBeat) MinBeat = B;
    }

    for (I = 0; I < (State.SelectedNotes || []).length; I++) {
        Parts = String(State.SelectedNotes[I]).split(":");
        if (Parts.length < 2) continue;
        for (Ci = 0; Ci < State.Channels.length; Ci++) {
            Channel = State.Channels[Ci];
            if (Channel.Id !== Parts[0] || !Channel.Notes) continue;
            var N = Channel.Notes[Number(Parts[1])];
            if (!N) continue;
            TrackMin(N.Beat || 0);
            Notes.push({
                ChannelId: Channel.Id,
                Note: N.Note,
                Beat: N.Beat || 0,
                Velocity: N.Velocity,
                DurationBeats: N.DurationBeats || 0.25,
                FilterHz: N.FilterHz,
                Events: N.Events ? JSON.parse(JSON.stringify(N.Events)) : null
            });
        }
    }

    for (I = 0; I < (State.SelectedClips || []).length; I++) {
        Parts = String(State.SelectedClips[I]).split(":");
        if (Parts.length < 2) continue;
        for (Ci = 0; Ci < State.Channels.length; Ci++) {
            Channel = State.Channels[Ci];
            if (Channel.Id !== Parts[0]) continue;
            var Cj;
            for (Cj = 0; Cj < Channel.Clips.length; Cj++) {
                if (String(Channel.Clips[Cj].Id) !== String(Parts[1])) continue;
                TrackMin(Channel.Clips[Cj].StartBeat || 0);
                Clips.push({
                    ChannelId: Channel.Id,
                    StartBeat: Channel.Clips[Cj].StartBeat || 0,
                    DurationBeats: Channel.Clips[Cj].DurationBeats || 1
                });
            }
        }
    }

    State.Clipboard = {
        Notes: Notes,
        Clips: Clips,
        AnchorBeat: MinBeat == null ? 0 : MinBeat
    };
    return Notes.length + Clips.length;
}

function CopySelectedTimelineItems() {
    var N = SnapshotSelectionToClipboard();
    return N > 0;
}

function CutSelectedTimelineItems() {
    if (!SnapshotSelectionToClipboard()) return false;
    return DeleteSelectedTimelineItems();
}

function DuplicateSelectedTimelineItems() {
    if (!SnapshotSelectionToClipboard()) return false;
    // Paste offset by 1 beat from original positions (relative to anchor = 0 offset via +1)
    return PasteClipboardItems(1);
}

function PasteClipboardItems(ExtraOffsetBeats) {
    if (!State.Clipboard) return false;
    var Notes = State.Clipboard.Notes || [];
    var Clips = State.Clipboard.Clips || [];
    if (!Notes.length && !Clips.length) return false;

    var Anchor = State.Clipboard.AnchorBeat || 0;
    var PlayBeat = Engine.SecondsToBeats(State.Simulation.Time || 0);
    var BaseOffset = (ExtraOffsetBeats != null)
        ? (ExtraOffsetBeats)
        : (PlayBeat - Anchor);
    var I;
    var Entry;
    var Channel;
    var Ci;
    var NewKeys = [];
    var NewClipKeys = [];

    function FindChannel(Id) {
        var X;
        for (X = 0; X < State.Channels.length; X++) {
            if (State.Channels[X].Id === Id) return State.Channels[X];
        }
        return GetSelectedChannel() || State.Channels[0] || null;
    }

    for (I = 0; I < Notes.length; I++) {
        Entry = Notes[I];
        Channel = FindChannel(Entry.ChannelId);
        if (!Channel) continue;
        if (!Channel.Notes) Channel.Notes = [];
        var Copy = {
            Note: Entry.Note,
            Beat: Math.max(0, (Entry.Beat || 0) + BaseOffset),
            Velocity: Entry.Velocity,
            DurationBeats: Entry.DurationBeats || 0.25,
            FilterHz: Entry.FilterHz
        };
        if (Entry.Events) Copy.Events = JSON.parse(JSON.stringify(Entry.Events));
        else EnsureNoteEvents(Copy);
        Channel.Notes.push(Copy);
        NewKeys.push(NoteKey(Channel.Id, Channel.Notes.length - 1));
    }

    for (I = 0; I < Clips.length; I++) {
        Entry = Clips[I];
        Channel = FindChannel(Entry.ChannelId);
        if (!Channel) continue;
        if (!Channel.Clips) Channel.Clips = [];
        var NewId = Guid();
        Channel.Clips.push({
            Id: NewId,
            StartBeat: Math.max(0, (Entry.StartBeat || 0) + BaseOffset),
            DurationBeats: Entry.DurationBeats || 1
        });
        NewClipKeys.push(ClipKey(Channel.Id, NewId));
    }

    State.SelectedNotes = NewKeys;
    State.SelectedClips = NewClipKeys;
    if (NewKeys.length) {
        var P = String(NewKeys[NewKeys.length - 1]).split(":");
        State.SelectedNote = { ChannelId: P[0], Index: Number(P[1]) };
    }
    DrawTimeline();
    if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
    if (State.Simulation.Playing) RescheduleTransport();
    return true;
}

function FindNoteAt(ClientX, ClientY) {
    var Rect = TimelineCanvas.getBoundingClientRect();
    var X = ClientX - Rect.left + PlaylistBody.scrollLeft;
    var Y = ClientY - Rect.top + PlaylistBody.scrollTop;
    var Lane = Math.floor(Y / State.TrackHeight);
    var Channel;
    var Index;
    var N;
    var Nx;
    var Nw;
    var Ny;
    var NoteH;
    var Edge = 5;

    if (Lane < 0 || Lane >= State.Channels.length) return null;
    Channel = State.Channels[Lane];
    if (!Channel.Notes) return null;

    NoteH = Math.max(10, State.TrackHeight * 0.22);

    for (Index = Channel.Notes.length - 1; Index >= 0; Index--) {
        N = Channel.Notes[Index];
        Nx = N.Beat * State.PixelsPerBeat;
        Nw = Math.max(6, (N.DurationBeats || 0.25) * State.PixelsPerBeat);
        Ny = NoteLaneY(N.Note, Lane * State.TrackHeight, State.TrackHeight);

        if (X >= Nx && X <= Nx + Nw && Y >= Ny && Y <= Ny + NoteH) {
            var Mode = "move";
            if (X <= Nx + Edge) Mode = "resize-left";
            else if (X >= Nx + Nw - Edge) Mode = "resize-right";
            return {
                Channel: Channel,
                ChannelId: Channel.Id,
                Index: Index,
                Note: N,
                Mode: Mode,
                Lane: Lane
            };
        }
    }
    return null;
}

function MidiFromClientY(ClientY, Lane) {
    var Rect = TimelineCanvas.getBoundingClientRect();
    var Y = ClientY - Rect.top + PlaylistBody.scrollTop;
    var TrackY = Lane * State.TrackHeight;
    var TrackH = State.TrackHeight;
    var NoteH = Math.max(10, TrackH * 0.22);
    var Top = TrackY + 4;
    var Usable = TrackH - NoteH - 8;
    var Local = (Y - Top) / Math.max(1, Usable);
    if (Local < 0) Local = 0;
    if (Local > 1) Local = 1;
    return Math.round(96 - Local * (96 - 36));
}

function Truncate(Text, MaxChars) {
    if (!Text) return "";
    if (Text.length <= MaxChars) return Text;
    return Text.slice(0, Math.max(0, MaxChars - 1)) + "...";
}

function BuildPeaks(Buffer, BucketCount) {
    var Data = Buffer.getChannelData(0);
    var BucketSize = Math.floor(Data.length / BucketCount) || 1;
    var Peaks = new Float32Array(BucketCount);
    var Index;
    var Inner;
    var Start;
    var End;
    var Max;
    var Abs;

    for (Index = 0; Index < BucketCount; Index++) {
        Max = 0;
        Start = Index * BucketSize;
        End = Math.min(Data.length, Start + BucketSize);
        for (Inner = Start; Inner < End; Inner++) {
            Abs = Math.abs(Data[Inner]);
            if (Abs > Max) Max = Abs;
        }
        Peaks[Index] = Max;
    }

    return Peaks;
}

function EnsureChannelPeaks(Channel) {
    if (Channel.Peaks) return;
    var Buffer = Engine.Buffers.get(Channel.SampleUrl);
    if (!Buffer) return;
    Channel.Peaks = BuildPeaks(Buffer, 128);
}

function UpdateWaveformSource() {
    var Index;
    var Channel;

    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        if (!Channel.Peaks && Engine.Buffers.has(Channel.SampleUrl)) {
            EnsureChannelPeaks(Channel);
        }
    }
}

function TimelineContentXFromClientX(ClientX) {
    // Canvas is inside PlaylistBody; getBoundingClientRect is the visible viewport of the canvas element.
    // Adding scrollLeft converts viewport-local X into content coordinates on the scrollable canvas.
    var Rect = TimelineCanvas.getBoundingClientRect();
    return ClientX - Rect.left + PlaylistBody.scrollLeft;
}

function BeatFromClientX(ClientX) {
    var X = TimelineContentXFromClientX(ClientX);
    var Beat = X / State.PixelsPerBeat;
    if (Beat < 0) Beat = 0;
    if (Beat > State.TotalBeats) Beat = State.TotalBeats;
    return Beat;
}

function ClientLocalXFromBeat(Beat) {
    // X within the canvas content (not screen)
    return Beat * State.PixelsPerBeat;
}

function BeatFromRulerClientX(ClientX) {
    var Rect = RulerCanvas.getBoundingClientRect();
    var X = ClientX - Rect.left + PlaylistBody.scrollLeft;
    var Beat = X / State.PixelsPerBeat;
    if (Beat < 0) Beat = 0;
    if (Beat > State.TotalBeats) Beat = State.TotalBeats;
    return Beat;
}

function ChannelIndexFromClientY(ClientY) {
    var Rect = TimelineCanvas.getBoundingClientRect();
    var Y = ClientY - Rect.top + PlaylistBody.scrollTop;
    return Math.floor(Y / State.TrackHeight);
}

function FindClipAt(ClientX, ClientY) {
    var Beat = BeatFromClientX(ClientX);
    var Index = ChannelIndexFromClientY(ClientY);
    var Channel = State.Channels[Index];
    var ClipIndex;
    var Clip;
    var End;

    if (!Channel) return null;

    for (ClipIndex = Channel.Clips.length - 1; ClipIndex >= 0; ClipIndex--) {
        Clip = Channel.Clips[ClipIndex];
        End = Clip.StartBeat + Clip.DurationBeats;
        if (Beat >= Clip.StartBeat && Beat <= End) {
            return { Channel: Channel, Clip: Clip, ChannelIndex: Index };
        }
    }

    return { Channel: Channel, Clip: null, ChannelIndex: Index };
}


function SeekToClientX(ClientX, FromRuler, Options) {
    Options = Options || {};
    var Beat = FromRuler ? BeatFromRulerClientX(ClientX) : BeatFromClientX(ClientX);
    if (Beat < 0) Beat = 0;
    if (Beat > State.TotalBeats) Beat = State.TotalBeats;
    var Seconds = Engine.BeatsToSeconds(Beat);

    // During scrub: only move the playhead visually — never reschedule audio each frame
    if (State.Scrubbing || Options.Scrub) {
        State.Simulation.Time = Seconds;
        if (Engine.Ctx) {
            Engine.StartSongTime = Seconds;
            Engine.StartCtxTime = Engine.Ctx.currentTime;
        }
        DrawAll();
        if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
        return;
    }

    var WasPlaying = State.Simulation.Playing;
    if (WasPlaying) {
        HardStopAllVoices();
        State.Simulation.Playing = false;
    }

    State.Simulation.Time = Seconds;

    if (WasPlaying && Options.Resume !== false) {
        StartPlaybackFromPlayhead();
    } else {
        UpdatePlayIcon();
        DrawAll();
        if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
    }
}

function StartTimelineScrub(Event, FromRuler) {
    State.Scrubbing = true;
    State.WasPlayingBeforeScrub = !!State.Simulation.Playing;
    TimelineCanvas.style.cursor = "ew-resize";
    RulerCanvas.style.cursor = "ew-resize";

    // Stop audio once at scrub start
    if (State.WasPlayingBeforeScrub) {
        HardStopAllVoices();
        State.Simulation.Playing = false;
        UpdatePlayIcon();
    }

    SeekToClientX(Event.clientX, FromRuler, { Scrub: true });

    function OnMove(Ev) {
        if (!State.Scrubbing) return;
        SeekToClientX(Ev.clientX, FromRuler, { Scrub: true });
    }

    function OnUp() {
        State.Scrubbing = false;
        TimelineCanvas.style.cursor = "crosshair";
        RulerCanvas.style.cursor = "pointer";
        window.removeEventListener("mousemove", OnMove);
        window.removeEventListener("mouseup", OnUp);
        var Resume = State.WasPlayingBeforeScrub;
        State.WasPlayingBeforeScrub = false;
        if (Resume) {
            StartPlaybackFromPlayhead();
        } else {
            DrawAll();
        }
    }

    window.addEventListener("mousemove", OnMove);
    window.addEventListener("mouseup", OnUp);
}

function StartChannelDrag(Channel, Event) {
    Event.preventDefault();
    State.ChannelDrag = {
        Channel: Channel,
        StartX: Event.clientX,
        StartY: Event.clientY,
        Active: false,
        PreviewBeat: 0,
        PreviewLane: 0,
        PreviewDur: 4,
        OverTimeline: false
    };
}

function UpdateChannelDrag(Event) {
    var Drag = State.ChannelDrag;
    var Dx;
    var Dy;
    var Beat;
    var Lane;
    var Buffer;
    var DurBeats;
    var Rect;
    var OverTimeline;

    if (!Drag) return;

    Dx = Event.clientX - Drag.StartX;
    Dy = Event.clientY - Drag.StartY;

    if (!Drag.Active && (Math.abs(Dx) > 6 || Math.abs(Dy) > 6)) {
        Drag.Active = true;
        DragGhost.textContent = Drag.Channel.Name;
        DragGhost.classList.add("Visible");
        Playlist.classList.add("DropTarget");

        var Rows = ChannelList.querySelectorAll(".ChannelRow");
        var Index;
        for (Index = 0; Index < Rows.length; Index++) {
            if (Rows[Index].getAttribute("data-id") === Drag.Channel.Id) {
                Rows[Index].classList.add("Dragging");
            }
        }
    }

    if (!Drag.Active) return;

    DragGhost.style.left = (Event.clientX + 12) + "px";
    DragGhost.style.top = (Event.clientY + 12) + "px";

    Rect = TimelineCanvas.getBoundingClientRect();
    OverTimeline =
        Event.clientX >= Rect.left &&
        Event.clientX <= Rect.right &&
        Event.clientY >= Rect.top &&
        Event.clientY <= Rect.bottom;

    Drag.OverTimeline = OverTimeline;

    if (OverTimeline) {
        Beat = BeatFromClientX(Event.clientX);
        Lane = ChannelIndexFromClientY(Event.clientY);
        if (Lane < 0) Lane = 0;
        if (Lane >= State.Channels.length) Lane = State.Channels.length - 1;

        DurBeats = DefaultDropDurationBeats(Drag.Channel);

        Drag.PreviewBeat = Beat;
        Drag.PreviewLane = Lane;
        Drag.PreviewDur = DurBeats;
    }

    DrawTimeline();
}

function FinishChannelDrag(Event) {
    var Drag = State.ChannelDrag;
    var Rect;
    var OverTimeline;
    var Beat;

    if (!Drag) return;

    if (Drag.Active) {
        Rect = TimelineCanvas.getBoundingClientRect();
        OverTimeline =
            Event.clientX >= Rect.left &&
            Event.clientX <= Rect.right &&
            Event.clientY >= Rect.top &&
            Event.clientY <= Rect.bottom;

        if (OverTimeline) {
            Beat = BeatFromClientX(Event.clientX);
            PlaceClipOnChannel(Drag.Channel, Beat);
            State.SelectedChannelId = Drag.Channel.Id;
            RenderChannels();
            UpdateWaveformSource();
        }
    }

    DragGhost.classList.remove("Visible");
    Playlist.classList.remove("DropTarget");

    var Rows = ChannelList.querySelectorAll(".ChannelRow");
    var Index;
    for (Index = 0; Index < Rows.length; Index++) {
        Rows[Index].classList.remove("Dragging");
    }

    State.ChannelDrag = null;
}


function GetSelectedChannel() {
    var Index;
    for (Index = 0; Index < State.Channels.length; Index++) {
        if (State.Channels[Index].Id === State.SelectedChannelId) {
            return State.Channels[Index];
        }
    }
    return State.Channels[0] || null;
}


function GetChannelPlugin(Channel) {
    if (!Channel) return null;
    if (!Channel.Plugin) {
        if (Channel.SampleUrl) {
            Channel.Plugin = PluginRegistry.sampler.Create({ SampleUrl: Channel.SampleUrl });
        } else {
            Channel.Plugin = PluginRegistry.synth.Create();
        }
    }
    if (Channel.SampleUrl && Channel.Plugin && !Channel.Plugin.SampleUrl) {
        Channel.Plugin.SampleUrl = Channel.SampleUrl;
    }
    return Channel.Plugin;
}

function EnsurePlayableChannel() {
    var Channel = GetSelectedChannel();

    if (State.PianoRoll && State.PianoRoll.Open && State.PianoRoll.ChannelId) {
        var Index;
        for (Index = 0; Index < State.Channels.length; Index++) {
            if (State.Channels[Index].Id === State.PianoRoll.ChannelId) {
                return State.Channels[Index];
            }
        }
    }

    if (Channel && !Channel.Muted) return Channel;

    if (State.Channels.length === 0) {
        AddPluginChannel("synth");
        return GetSelectedChannel();
    }

    if (!Channel) {
        State.SelectedChannelId = State.Channels[0].Id;
        Channel = State.Channels[0];
        RenderChannels();
    }

    return Channel;
}

function IsNoteHeld(Note) {
    return !!(State.MouseHolds[Note] || State.KeyHolds[Note]);
}

function NoteInputOn(Note, Source, Options) {
    Options = Options || {};
    Engine.EnsureCtx();

    if (Source === "mouse") {
        State.MouseHolds[Note] = true;
    } else if (Source === "key") {
        State.KeyHolds[Note] = true;
    }

    // Already sounding from either source - do not re-trigger
    if (State.ActiveVoices[Note] && !Options.Force) {
        return;
    }

    var Channel = EnsurePlayableChannel();
    if (!Channel || Channel.Muted) {
        if (Source === "mouse") delete State.MouseHolds[Note];
        if (Source === "key") delete State.KeyHolds[Note];
        return;
    }

    var Plugin = GetChannelPlugin(Channel);
    if (!Plugin) {
        if (Channel.SampleUrl) {
            Channel.Plugin = PluginRegistry.sampler.Create({ SampleUrl: Channel.SampleUrl });
        } else {
            Channel.Plugin = PluginRegistry.synth.Create();
        }
        Plugin = Channel.Plugin;
    }

    if (Plugin && Channel.SampleUrl && !Plugin.SampleUrl) {
        Plugin.SampleUrl = Channel.SampleUrl;
    }

    var Def = PluginRegistry[Plugin.Id];
    if (!Def || !Def.NoteOn) {
        Def = PluginRegistry.synth;
        if (!Channel.Plugin || Channel.Plugin.Id !== "synth") {
            Channel.Plugin = PluginRegistry.synth.Create();
            Plugin = Channel.Plugin;
        }
    }

    var VelEl = document.querySelector("#PianoVel");
    var Velocity = Options.Velocity != null ? Options.Velocity : (VelEl ? Number(VelEl.value) / 100 : 0.85);
    if (Velocity < 0.05) Velocity = 0.05;

    ApplyPianoSettingsToPlugin(Plugin);

    if ((State.Recording && State.Simulation.Playing) || Options.RecordAtBeat != null) {
        if (!Channel.Notes) Channel.Notes = [];
        var Beat = Options.RecordAtBeat != null
            ? Options.RecordAtBeat
            : Engine.SecondsToBeats(Engine.GetSongTime());
        var CutEl = document.querySelector("#PianoCut");
        var FilterHz = Options.FilterHz != null
            ? Options.FilterHz
            : (CutEl ? 200 + Math.pow(Number(CutEl.value) / 100, 2) * 12000 : null);
        var Entry = {
            Note: Note,
            Beat: Beat,
            Velocity: Velocity,
            DurationBeats: Options.DurationBeats != null ? Options.DurationBeats : 0.25,
            FilterHz: FilterHz,
            StartMs: performance.now()
        };
        EnsureNoteEvents(Entry);
        Channel.Notes.push(Entry);
        State.RecordArm[Note] = Entry;
        DrawTimeline();
        if (State.PianoRoll.Open) DrawPianoRoll();
    }

    if (Plugin.Id === "sampler") {
        if (!Plugin.SampleUrl && Channel.SampleUrl) Plugin.SampleUrl = Channel.SampleUrl;
        if (Plugin.SampleUrl && !Engine.Buffers.has(Plugin.SampleUrl)) {
            Engine.LoadSample(Plugin.SampleUrl).then(function () {
                if (!IsNoteHeld(Note)) return;
                var Voice = Def.NoteOn(Engine, Plugin, Note, Velocity, Options.NoteParams || {});
                if (Voice) State.ActiveVoices[Note] = Voice;
            }).catch(function (Err) {
                console.warn("Sample load failed", Err);
            });
            return;
        }
    }

    if (State.ActiveVoices[Note]) {
        try {
            var Old = State.ActiveVoices[Note];
            var OldDef = PluginRegistry[Old.Plugin.Id] || Def;
            OldDef.NoteOff(Engine, Old);
        } catch (_) {}
        delete State.ActiveVoices[Note];
    }

    if (Def.NoteOn && (Plugin.Id !== "sampler" || Plugin.SampleUrl)) {
        var LiveParams = Options.NoteParams || {};
        var Voice = Def.NoteOn(Engine, Plugin, Note, Velocity, LiveParams);
        if (Voice) State.ActiveVoices[Note] = Voice;
    }
}

function NoteInputOff(Note, Source) {
    if (Source === "mouse") {
        delete State.MouseHolds[Note];
    } else if (Source === "key") {
        delete State.KeyHolds[Note];
    }

    // Still held by the other input source - keep sounding
    if (IsNoteHeld(Note)) return;

    var Armed = State.RecordArm[Note];
    if (Armed && Armed.StartMs != null) {
        var Held = Math.max(0.05, (performance.now() - Armed.StartMs) / 1000);
        Armed.DurationBeats = Math.max(0.05, Engine.SecondsToBeats(Held));
        delete State.RecordArm[Note];
        DrawTimeline();
        if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
    }

    var Voice = State.ActiveVoices[Note];
    if (!Voice) return;
    var Plugin = Voice.Plugin;
    var Def = PluginRegistry[Plugin.Id] || PluginRegistry.sampler;
    try {
        Def.NoteOff(Engine, Voice);
    } catch (_) {}
    delete State.ActiveVoices[Note];
}

function ReleaseAllMouseHolds() {
    var Notes = Object.keys(State.MouseHolds);
    var Index;
    for (Index = 0; Index < Notes.length; Index++) {
        NoteInputOff(Number(Notes[Index]), "mouse");
        var Key = document.querySelector('.PianoKey[data-note="' + Notes[Index] + '"]');
        if (Key && !State.KeyHolds[Notes[Index]]) Key.classList.remove("Down");
        var RollKey = document.querySelector('.PianoRollKey[data-note="' + Notes[Index] + '"]');
        if (RollKey && !State.KeyHolds[Notes[Index]]) RollKey.classList.remove("Down");
    }
    State.MouseHolds = {};
    State.PianoPointerDown = false;
    State.PianoLastNote = null;
}

function ReleaseAllKeyHolds() {
    var Notes = Object.keys(State.KeyHolds);
    var Index;
    for (Index = 0; Index < Notes.length; Index++) {
        NoteInputOff(Number(Notes[Index]), "key");
    }
}

function ReleaseAllHolds() {
    ReleaseAllMouseHolds();
    ReleaseAllKeyHolds();
    // Defensive: kill any leftover voices
    var Midi;
    for (Midi in State.ActiveVoices) {
        if (!State.ActiveVoices.hasOwnProperty(Midi)) continue;
        try {
            var Voice = State.ActiveVoices[Midi];
            var Def = PluginRegistry[Voice.Plugin.Id];
            if (Def && Def.NoteOff) Def.NoteOff(Engine, Voice);
        } catch (_) {}
    }
    State.ActiveVoices = {};
    State.MouseHolds = {};
    State.KeyHolds = {};
    State.HeldKeys = {};
}

// Compatibility wrappers
function PianoNoteOn(Note, Options) {
    NoteInputOn(Note, Options && Options.Source ? Options.Source : "mouse", Options);
}

function PianoNoteOff(Note, Source) {
    NoteInputOff(Note, Source || "mouse");
}

function ApplyPianoSettingsToPlugin(Plugin) {
    if (!Plugin) return;
    var Wave = document.querySelector("#PluginWave");
    var Atk = document.querySelector("#PianoAtk");
    var Dec = document.querySelector("#PianoDec");
    var Sus = document.querySelector("#PianoSus");
    var Rel = document.querySelector("#PianoRel");
    var Cut = document.querySelector("#PianoCut");

    if (Wave && Plugin.Wave != null) Plugin.Wave = Wave.value;
    if (Atk) Plugin.Attack = 0.001 + Number(Atk.value) / 100 * 0.5;
    if (Dec) Plugin.Decay = 0.01 + Number(Dec.value) / 100 * 0.8;
    if (Sus) Plugin.Sustain = Number(Sus.value) / 100;
    if (Rel) Plugin.Release = 0.02 + Number(Rel.value) / 100 * 1.2;
    if (Cut && Plugin.FilterHz != null) {
        Plugin.FilterHz = 200 + Math.pow(Number(Cut.value) / 100, 2) * 12000;
    }

    var GlideEl = document.querySelector("#PianoGlide");
    if (GlideEl && Plugin.Glide != null) {
        Plugin.Glide = Number(GlideEl.value) / 100 * 0.5;
    }
}

function SetPianoOctave(Oct) {
    State.PianoOctave = Math.max(0, Math.min(7, Oct));
    var OctEl = document.querySelector("#PianoOctave");
    if (OctEl) OctEl.value = State.PianoOctave;
    BuildPianoKeys();
}

function AddPluginChannel(PluginId) {
    var Def = PluginRegistry[PluginId];
    if (!Def) return;

    var Plugin = Def.Create();
    var Id = Guid();
    var Color = Colors[State.Channels.length % Colors.length];

    var Channel = {
        Id: Id,
        Name: Plugin.Name,
        SampleUrl: "",
        Color: Color,
        Muted: false,
        Clips: [],
        Pattern: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        StretchToClip: false,
        SyncToTempo: false,
        SampleBpm: 120,
        Gain: 1,
        Fx: DefaultChannelFx(),
        Plugin: Plugin,
        Notes: []
    };

    State.Channels.push(Channel);
    State.SelectedChannelId = Id;
    RenderChannels();
    ResizeCanvases();
}



function EnsureChannelFx(Channel) {
    if (!Channel) return DefaultChannelFx();
    if (!Channel.Fx || typeof Channel.Fx !== "object") {
        Channel.Fx = DefaultChannelFx();
    }
    var Fx = Channel.Fx;
    if (Fx.Filter == null) Fx.Filter = 100;
    if (Fx.Delay == null) Fx.Delay = 0;
    if (Fx.Reverb == null) Fx.Reverb = 0;
    if (Fx.Drive == null) Fx.Drive = 0;
    if (Fx.EqLow == null) Fx.EqLow = 0;
    if (Fx.EqMid == null) Fx.EqMid = 0;
    if (Fx.EqHigh == null) Fx.EqHigh = 0;
    if (Fx.Pan == null) Fx.Pan = 0;
    return Fx;
}

function DefaultChannelFx() {
    return { Filter: 100, Delay: 0, Reverb: 0, Drive: 0, EqLow: 0, EqMid: 0, EqHigh: 0, Pan: 0 };
}

function StepSynthKindForChannel(Channel, ChannelIndex) {
    var Name = ((Channel && Channel.Name) || "").toLowerCase();
    if (Name.indexOf("kick") >= 0 || Name.indexOf("bd") >= 0) return "kick";
    if (Name.indexOf("snare") >= 0 || Name.indexOf("sd") >= 0) return "snare";
    if (Name.indexOf("hat") >= 0 || Name.indexOf("hh") >= 0 || Name.indexOf("hi-hat") >= 0) return "hat";
    var Kinds = ["kick", "snare", "hat", "kick", "snare", "hat", "kick", "hat"];
    return Kinds[(ChannelIndex || 0) % Kinds.length];
}

function PlayChannelStepPreview(Channel, ChannelIndex) {
    Engine.EnsureCtx();
    EnsureChannelFx(Channel);
    var Gain = Channel.Gain == null ? 1 : Channel.Gain;
    if (Channel.SampleUrl && Engine.Buffers.has(Channel.SampleUrl)) {
        Engine.PlayOneShot(Channel.SampleUrl, Gain, 1);
        return;
    }
    if (Channel.SampleUrl && Channel.SampleUrl.indexOf("http") === 0) {
        Engine.LoadSample(Channel.SampleUrl).then(function () {
            Engine.PlayOneShot(Channel.SampleUrl, Gain, 1);
        }).catch(function () {
            Engine.PlayStepSynth(StepSynthKindForChannel(Channel, ChannelIndex), Gain, null, Channel.Fx);
        });
        return;
    }
    Engine.PlayStepSynth(StepSynthKindForChannel(Channel, ChannelIndex), Gain, null, Channel.Fx);
}


function NormalizePattern(Raw) {
    var Out = [];
    var Index;
    var Value;
    if (Array.isArray(Raw)) {
        for (Index = 0; Index < 16; Index++) {
            Value = Raw[Index];
            Out.push(Value === true || Value === 1 || Value === "1" || Value === "true");
        }
        return Out;
    }
    if (Raw && typeof Raw === "object") {
        for (Index = 0; Index < 16; Index++) {
            Value = Raw[Index] != null ? Raw[Index] : Raw[String(Index)];
            Out.push(Value === true || Value === 1 || Value === "1" || Value === "true");
        }
        return Out;
    }
    for (Index = 0; Index < 16; Index++) Out.push(false);
    return Out;
}

function SerializeProject() {
    var Channels = [];
    var Index;
    var Channel;
    var Safe;

    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        Safe = {
            Name: Channel.Name,
            SampleUrl: Channel.SampleUrl || "",
            Color: Channel.Color,
            Muted: !!Channel.Muted,
            Clips: Channel.Clips || [],
            Pattern: NormalizePattern(Channel.Pattern).map(function (V) { return V ? 1 : 0; }),
            Notes: Channel.Notes || [],
            PluginId: Channel.Plugin ? Channel.Plugin.Id : "sampler",
            Plugin: Channel.Plugin || null,
            StretchToClip: !!Channel.StretchToClip,
            Gain: Channel.Gain == null ? 1 : Channel.Gain,
            Fx: (function (F) {
                EnsureChannelFx({ Fx: F });
                return {
                    Filter: F.Filter, Delay: F.Delay, Reverb: F.Reverb, Drive: F.Drive,
                    EqLow: F.EqLow, EqMid: F.EqMid, EqHigh: F.EqHigh, Pan: F.Pan
                };
            })(Channel.Fx || DefaultChannelFx())
        };
        Channels.push(Safe);
    }

    return {
        Id: State.ProjectId || null,
        Name: (document.querySelector("#ProjectName") || {}).value || "Untitled Project",
        Author: State.User ? (State.User.Username || State.User.DisplayName) : "anonymous",
        Channels: Channels,
        Tempo: Number(TempoInput.value) || 120,
        Timestamp: Date.now()
    };
}

function NewEmptyProject() {
    if (State.Simulation.Playing) StopTransport();
    State.ProjectId = null;
    State.Channels = [];
    State.SelectedChannelId = null;
    State.SelectedNote = null;
    State.Simulation.Time = 0;
    Engine.Stop();
    var NameEl = document.querySelector("#ProjectName");
    if (NameEl) NameEl.value = "Untitled Project";
    if (TempoInput) {
        TempoInput.value = 120;
        Engine.SetBpm(120);
    }
    UpdatePlayIcon();
    RenderChannels();
    ResizeCanvases();
    DrawAll();
    UpdatePublishLabel();
    var Status = document.querySelector("#PublishStatus");
    if (Status) Status.textContent = "New project";
    setTimeout(function () {
        if (Status) Status.textContent = "";
    }, 1500);
}

function UniqueProjectName(BaseName) {
    var Name = (BaseName || "Untitled Project").trim() || "Untitled Project";
    var Existing = {};
    var Index;
    var Project;
    for (Index = 0; Index < (State.Projects || []).length; Index++) {
        Project = State.Projects[Index];
        if (Project && Project.Name) Existing[String(Project.Name)] = true;
    }
    if (!Existing[Name]) return Name;
    var Suffix = 2;
    while (Existing[Name + " - " + Suffix]) Suffix++;
    return Name + " - " + Suffix;
}

function PublishProject() {
    if (!State.User) {
        ShowNotice("Sign in to save a project.");
        ShowModal("SignInModal");
        return;
    }

    var Username = State.User.Username || State.User.DisplayName;
    var Status = document.querySelector("#PublishStatus");
    if (Status) Status.textContent = "Saving...";

    UploadLocalMicTakes(Username).then(function () {
        var Payload = SerializeProject();
        Payload.Author = Username;
        return SaveProject(Payload, { CurrentUser: Username });
    }).then(function (Result) {
        State.ProjectId = Result.Id;
        if (Status) Status.textContent = "Saved";
        setTimeout(function () {
            if (Status) Status.textContent = "";
        }, 2000);
        UpdatePublishLabel();
        RefreshBrowser();
    }).catch(function (Error) {
        console.error(Error);
        if (Status) Status.textContent = "Save failed";
        ShowNotice(Error.message || "Save failed");
    });
}

function SaveProjectAs() {
    if (!State.User) {
        ShowNotice("Sign in to save a project.");
        ShowModal("SignInModal");
        return;
    }

    var Username = State.User.Username || State.User.DisplayName;
    var NameEl = document.querySelector("#ProjectName");
    var BaseName = NameEl ? NameEl.value : "Untitled Project";
    var NewName = UniqueProjectName(BaseName);
    if (NameEl) NameEl.value = NewName;

    State.ProjectId = null;
    UpdatePublishLabel();

    var Status = document.querySelector("#PublishStatus");
    if (Status) Status.textContent = "Saving as...";

    UploadLocalMicTakes(Username).then(function () {
        var Payload = SerializeProject();
        Payload.Id = null;
        Payload.Author = Username;
        Payload.Name = NewName;
        return SaveProject(Payload, { CurrentUser: Username });
    }).then(function (Result) {
        State.ProjectId = Result.Id;
        if (Status) Status.textContent = "Saved as " + NewName;
        setTimeout(function () {
            if (Status) Status.textContent = "";
        }, 2500);
        UpdatePublishLabel();
        RefreshBrowser();
    }).catch(function (Error) {
        console.error(Error);
        if (Status) Status.textContent = "Save As failed";
        ShowNotice(Error.message || "Save As failed");
    });
}

function UploadLocalMicTakes(Username) {
    if (!State.LocalBlobs) State.LocalBlobs = {};
    var Tasks = [];
    var Index;
    var Channel;
    var Key;
    var Entry;
    var LocalKey;

    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        Key = Channel.SampleUrl || "";
        if (Key.indexOf("mic:") !== 0) continue;
        Entry = State.LocalBlobs[Key];
        if (!Entry || !Entry.Blob) continue;
        LocalKey = Key;
        Tasks.push((function (Ch, LocalKey, Entry) {
            return UploadSample(Entry.Blob, {
                Author: Username || "anonymous",
                Name: Entry.Name || Ch.Name || "Mic Take",
                Genre: "Recording",
                Mime: Entry.Mime || Entry.Blob.type || "audio/webm"
            }).then(function (Result) {
                var Url = Result.File || Result.DownloadUrl;
                var Buffer = Engine.Buffers.get(LocalKey);
                if (Buffer) Engine.RegisterBuffer(Url, Buffer);
                Ch.SampleUrl = Url;
                if (Ch.Plugin) Ch.Plugin.SampleUrl = Url;
                delete State.LocalBlobs[LocalKey];
                return Result;
            });
        })(Channel, LocalKey, Entry));
    }

    return Promise.all(Tasks);
}

function ApplyLoadedProject(Doc) {
    if (!Doc) return;

    State.ProjectId = Doc.Id || null;
    var NameEl = document.querySelector("#ProjectName");
    if (NameEl) NameEl.value = Doc.Name || "Untitled Project";
    if (Doc.Tempo && TempoInput) {
        TempoInput.value = Doc.Tempo;
        Engine.SetBpm(Doc.Tempo);
    }

    State.Channels = [];
    State.SelectedChannelId = null;
    State.SelectedNote = null;

    var List = Doc.Channels || [];
    var Index;
    var Raw;
    var Channel;
    var PluginId;
    var Plugin;

    for (Index = 0; Index < List.length; Index++) {
        Raw = List[Index] || {};
        PluginId = Raw.PluginId || (Raw.Plugin && Raw.Plugin.Id) || (Raw.SampleUrl ? "sampler" : "synth");
        if (PluginRegistry[PluginId]) {
            Plugin = PluginRegistry[PluginId].Create(Raw.Plugin || { SampleUrl: Raw.SampleUrl || "" });
            if (Raw.Plugin) {
                Object.keys(Raw.Plugin).forEach(function (Key) {
                    Plugin[Key] = Raw.Plugin[Key];
                });
            }
        } else {
            Plugin = PluginRegistry.synth.Create();
        }

        Channel = {
            Id: Guid(),
            Name: Raw.Name || ("Channel " + (Index + 1)),
            SampleUrl: Raw.SampleUrl || (Plugin.SampleUrl || ""),
            Color: Raw.Color || Colors[Index % Colors.length],
            Muted: !!Raw.Muted,
            Clips: Array.isArray(Raw.Clips) ? Raw.Clips : [],
            Pattern: NormalizePattern(Raw.Pattern),
            Notes: Array.isArray(Raw.Notes) ? Raw.Notes : [],
            Plugin: Plugin,
            StretchToClip: !!Raw.StretchToClip,
            Gain: Raw.Gain == null ? 1 : Raw.Gain,
            Fx: (function () {
                var Base = DefaultChannelFx();
                if (Raw.Fx && typeof Raw.Fx === "object") {
                    if (Raw.Fx.Filter != null) Base.Filter = Number(Raw.Fx.Filter);
                    if (Raw.Fx.Delay != null) Base.Delay = Number(Raw.Fx.Delay);
                    if (Raw.Fx.Reverb != null) Base.Reverb = Number(Raw.Fx.Reverb);
                    if (Raw.Fx.Drive != null) Base.Drive = Number(Raw.Fx.Drive);
                    if (Raw.Fx.EqLow != null) Base.EqLow = Number(Raw.Fx.EqLow);
                    if (Raw.Fx.EqMid != null) Base.EqMid = Number(Raw.Fx.EqMid);
                    if (Raw.Fx.EqHigh != null) Base.EqHigh = Number(Raw.Fx.EqHigh);
                    if (Raw.Fx.Pan != null) Base.Pan = Number(Raw.Fx.Pan);
                }
                return Base;
            })()
        };

        // Ensure each note has Events structure
        var Ni;
        for (Ni = 0; Ni < Channel.Notes.length; Ni++) {
            if (Channel.Notes[Ni]) EnsureNoteEvents(Channel.Notes[Ni]);
        }

        State.Channels.push(Channel);
        if (Channel.SampleUrl && Channel.SampleUrl.indexOf("http") === 0) {
            Engine.LoadSample(Channel.SampleUrl).catch(function () {});
        }
    }

    if (State.Channels.length) {
        State.SelectedChannelId = State.Channels[0].Id;
    }

    State.Simulation.Time = 0;
    State.Simulation.Playing = false;
    Engine.Stop();
    UpdatePlayIcon();
    RenderChannels();
    DrawAll();
    UpdateWaveformSource();
    UpdatePublishLabel();
}

function OpenProjectFromBrowser(Doc) {
    if (!Doc) return;
    if (State.Simulation.Playing) StopTransport();
    ApplyLoadedProject(Doc);
    var Status = document.querySelector("#UploadStatus");
    if (Status) {
        Status.textContent = "Opened: " + (Doc.Name || "Project") + " by " + (Doc.Author || "?");
        Status.className = "UploadStatus Ok";
    }
    UpdatePublishLabel();
}

function ToggleMicRecord() {
    Engine.EnsureCtx();
    var Btn = document.querySelector("#MicButton");

    if (Engine.MicRecording) {
        var StartBeat = State.MicStartBeat != null ? State.MicStartBeat : Engine.SecondsToBeats(State.Simulation.Time || 0);
        Engine.StopMicCapture().then(function (Result) {
            if (Btn) Btn.classList.remove("Active");
            State.MicStartBeat = null;
            if (!Result || !Result.Buffer) {
                ShowNotice("Could not capture microphone audio.");
                return;
            }
            var Buffer = Result.Buffer;
            var Key = "mic:" + Guid();
            Engine.RegisterBuffer(Key, Buffer);
            if (!State.LocalBlobs) State.LocalBlobs = {};
            State.LocalBlobs[Key] = {
                Blob: Result.Blob,
                Mime: Result.Mime || "audio/webm",
                Name: "Mic Take"
            };
            var DurBeats = Math.max(0.25, Engine.SecondsToBeats(Buffer.duration));
            var Sample = {
                Name: "Mic Take",
                File: Key,
                Author: State.User ? State.User.Username : "local",
                Genre: "Recording"
            };
            AddChannel(Sample);
            var Channel = State.Channels[State.Channels.length - 1];
            if (Channel) {
                Channel.SampleUrl = Key;
                Channel.Plugin = PluginRegistry.sampler.Create({ SampleUrl: Key });
                Channel.StretchToClip = true;
                if (!Channel.Clips) Channel.Clips = [];
                Channel.Clips.push({
                    Id: Guid(),
                    StartBeat: StartBeat,
                    DurationBeats: DurBeats
                });
            }
            DrawAll();
            RenderChannels();
            FinishRecordingSession();
        });
        return;
    }

    State.MicStartBeat = Engine.SecondsToBeats(
        State.Simulation.Playing ? Engine.GetSongTime() : (State.Simulation.Time || 0)
    );

    Engine.StartMicCapture().then(function () {
        if (Btn) Btn.classList.add("Active");
        if (!State.Simulation.Playing) {
            StartPlaybackFromPlayhead();
        }
    }).catch(function (Error) {
        console.error(Error);
        State.MicStartBeat = null;
        if (Btn) Btn.classList.remove("Active");
        ShowNotice("Microphone permission failed: " + (Error.message || Error));
    });
}


function GetPianoRollChannel() {
    if (!State.PianoRoll || !State.PianoRoll.ChannelId) return null;
    var Index;
    for (Index = 0; Index < State.Channels.length; Index++) {
        if (State.Channels[Index].Id === State.PianoRoll.ChannelId) {
            return State.Channels[Index];
        }
    }
    return null;
}

function SnapBeat(Beat) {
    var SnapEl = document.querySelector("#PianoRollSnap");
    var Snap = SnapEl ? Number(SnapEl.value) : 0.125;
    if (!Snap || !isFinite(Snap)) return Beat;
    return Math.round(Beat / Snap) * Snap;
}

function PianoRollLocalXY(ClientX, ClientY) {
    var Canvas = document.querySelector("#PianoRollCanvas");
    if (!Canvas) return { X: 0, Y: 0 };
    // Canvas is the scrolled content; getBoundingClientRect already accounts for
    // parent scroll, so do NOT add scrollLeft/scrollTop again.
    var Rect = Canvas.getBoundingClientRect();
    return {
        X: ClientX - Rect.left,
        Y: ClientY - Rect.top
    };
}

function EnsureNoteEvents(N) {
    if (!N) return null;
    if (!N.Events || typeof N.Events !== "object") {
        N.Events = {};
    }
    if (!N.Events.Mix) N.Events.Mix = [{ t: 0, v: N.Mix != null ? N.Mix : 1 }];
    if (!N.Events.Cutoff) {
        var CutV = 0.5;
        if (N.FilterHz != null) {
            CutV = Math.sqrt(Math.max(0, (N.FilterHz - 200) / 12000));
        }
        N.Events.Cutoff = [{ t: 0, v: CutV }];
    }
    if (!N.Events.Resonance) {
        N.Events.Resonance = [{ t: 0, v: N.Resonance != null ? Math.min(1, N.Resonance / 20) : 0.05 }];
    }
    if (!N.Events.Pan) {
        N.Events.Pan = [{ t: 0, v: N.Pan != null ? (N.Pan + 1) / 2 : 0.5 }];
    }
    if (!N.Events.Glide) {
        N.Events.Glide = [{ t: 0, v: N.Glide != null ? Math.min(1, N.Glide / 0.5) : 0 }];
    }
    return N.Events;
}

function MidiToRollY(Midi) {
    return (State.PianoRoll.HighMidi - Midi) * State.PianoRoll.RowH;
}

function RollYToMidi(Y) {
    var Midi = State.PianoRoll.HighMidi - Math.floor(Y / State.PianoRoll.RowH);
    if (Midi < State.PianoRoll.LowMidi) Midi = State.PianoRoll.LowMidi;
    if (Midi > State.PianoRoll.HighMidi) Midi = State.PianoRoll.HighMidi;
    return Midi;
}

function FindRollNoteAt(LocalX, LocalY) {
    var Channel = GetPianoRollChannel();
    if (!Channel || !Channel.Notes) return null;
    var Ppb = State.PianoRoll.PixelsPerBeat;
    var RowH = State.PianoRoll.RowH;
    var Index;
    var N;
    var X;
    var W;
    var Y;
    var Edge = 6;

    for (Index = Channel.Notes.length - 1; Index >= 0; Index--) {
        N = Channel.Notes[Index];
        if (!N) continue;
        X = (N.Beat || 0) * Ppb;
        W = Math.max(6, (N.DurationBeats || 0.25) * Ppb);
        Y = MidiToRollY(N.Note);
        if (LocalX >= X && LocalX <= X + W && LocalY >= Y && LocalY <= Y + RowH) {
            var Mode = "move";
            if (LocalX <= X + Edge) Mode = "resize-left";
            else if (LocalX >= X + W - Edge) Mode = "resize-right";
            return { Index: Index, Note: N, Mode: Mode };
        }
    }
    return null;
}

function AddChannel(Sample) {
    var Id = Guid();
    var Color = Colors[State.Channels.length % Colors.length];
    var Channel = {
        Id: Id,
        Name: Sample.Name || "Sample",
        SampleUrl: Sample.File,
        Color: Color,
        Muted: false,
        Clips: [],
        Pattern: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        StretchToClip: true,
        SyncToTempo: false,
        SampleBpm: 120,
        Gain: 1,
        Fx: DefaultChannelFx(),
        Plugin: PluginRegistry.sampler.Create({ SampleUrl: Sample.File }),
        Notes: []
    };

    State.Channels.push(Channel);

    Engine.LoadSample(Sample.File).then(function (Buffer) {
        var Index;
        for (Index = 0; Index < State.Channels.length; Index++) {
            if (State.Channels[Index].SampleUrl === Sample.File) {
                State.Channels[Index].Peaks = BuildPeaks(Buffer, 128);
            }
        }
        UpdateWaveformSource();
        DrawAll();
    }).catch(function (Error) {
        console.warn("Preload Failed", Error);
    });

    RenderChannels();
    ResizeCanvases();
    return Channel;
}

function PlaceClipOnChannel(Channel, StartBeat) {
    var DurationBeats = DefaultDropDurationBeats(Channel);
    var Start = Math.max(0, StartBeat);
    EnsureTimelineFitsBeat(Start + DurationBeats);
    Channel.Clips.push({
        Id: Guid(),
        StartBeat: Start,
        DurationBeats: DurationBeats
    });
    DrawTimeline();
}

function RefreshBrowser() {
    var SampleListEl = document.querySelector("#SampleList") || SampleList;
    var ProjectListEl = document.querySelector("#ProjectList");

    if (SampleListEl) SampleListEl.innerHTML = '<div class="Loading">Loading samples...</div>';
    if (ProjectListEl) ProjectListEl.innerHTML = '<div class="Loading">Loading projects...</div>';

    if (typeof ListSamples === "function") {
        ListSamples().then(function (Samples) {
            State.Samples = Samples || [];
            RenderSampleList();
        }).catch(function (Error) {
            if (SampleListEl) SampleListEl.innerHTML = '<div class="Error">Failed to load samples: ' + Error.message + '</div>';
        });
    }

    if (typeof ListProjects === "function") {
        ListProjects().then(function (Projects) {
            State.Projects = Projects || [];
            RenderProjectList();
        }).catch(function (Error) {
            console.error(Error);
            if (ProjectListEl) ProjectListEl.innerHTML = '<div class="Error">Failed to load projects: ' + Error.message + '</div>';
        });
    } else if (ProjectListEl) {
        ProjectListEl.innerHTML = '<div class="Error">ListProjects unavailable</div>';
    }
}

function EscapeHtml(Str) {
    return String(Str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function AudioBufferToWavBlob(Buffer) {
    var NumCh = Buffer.numberOfChannels;
    var SampleRate = Buffer.sampleRate;
    var NumFrames = Buffer.length;
    var BytesPerSample = 2;
    var BlockAlign = NumCh * BytesPerSample;
    var DataSize = NumFrames * BlockAlign;
    var ArrayBuf = new ArrayBuffer(44 + DataSize);
    var View = new DataView(ArrayBuf);
    var Offset = 0;
    function WriteStr(Str) {
        var I;
        for (I = 0; I < Str.length; I++) View.setUint8(Offset + I, Str.charCodeAt(I));
        Offset += Str.length;
    }
    function WriteU32(V) { View.setUint32(Offset, V, true); Offset += 4; }
    function WriteU16(V) { View.setUint16(Offset, V, true); Offset += 2; }
    WriteStr("RIFF");
    WriteU32(36 + DataSize);
    WriteStr("WAVE");
    WriteStr("fmt ");
    WriteU32(16);
    WriteU16(1);
    WriteU16(NumCh);
    WriteU32(SampleRate);
    WriteU32(SampleRate * BlockAlign);
    WriteU16(BlockAlign);
    WriteU16(16);
    WriteStr("data");
    WriteU32(DataSize);
    var Ch;
    var Channels = [];
    for (Ch = 0; Ch < NumCh; Ch++) Channels.push(Buffer.getChannelData(Ch));
    var Frame;
    var Sample;
    var Clamped;
    for (Frame = 0; Frame < NumFrames; Frame++) {
        for (Ch = 0; Ch < NumCh; Ch++) {
            Sample = Channels[Ch][Frame];
            Clamped = Math.max(-1, Math.min(1, Sample));
            View.setInt16(Offset, Clamped < 0 ? Clamped * 0x8000 : Clamped * 0x7FFF, true);
            Offset += 2;
        }
    }
    return new Blob([ArrayBuf], { type: "audio/wav" });
}

function SaveChannelAsSample(Channel) {
    if (!State.User) {
        ShowNotice("Sign in to save samples.");
        ShowModal("SignInModal");
        return;
    }
    if (!Channel || !Channel.SampleUrl) {
        ShowNotice("No sample on this channel.");
        return;
    }
    var Username = State.User.Username || State.User.DisplayName || "user";
    var Status = document.querySelector("#UploadStatus") || document.querySelector("#PublishStatus");
    if (Status) {
        Status.textContent = "Saving sample...";
        Status.className = "UploadStatus Busy";
    }

    function FinishUpload(BlobData, Name) {
        return UploadSample(BlobData, {
            Author: Username,
            Name: Name || Channel.Name || "Channel Sample",
            Genre: "From Project",
            Mime: BlobData.type || "audio/wav"
        }).then(function (Result) {
            if (Status) {
                Status.textContent = "Saved sample: " + Result.Name;
                Status.className = "UploadStatus Ok";
            }
            RefreshBrowser();
            return Result;
        });
    }

    var Key = Channel.SampleUrl;
    if (State.LocalBlobs && State.LocalBlobs[Key] && State.LocalBlobs[Key].Blob) {
        FinishUpload(State.LocalBlobs[Key].Blob, Channel.Name).catch(function (Err) {
            if (Status) {
                Status.textContent = "Save failed";
                Status.className = "UploadStatus Err";
            }
            ShowNotice(Err.message || "Save failed");
        });
        return;
    }

    var Buffer = Engine.Buffers.get(Key);
    if (Buffer) {
        FinishUpload(AudioBufferToWavBlob(Buffer), Channel.Name).catch(function (Err) {
            if (Status) {
                Status.textContent = "Save failed";
                Status.className = "UploadStatus Err";
            }
            ShowNotice(Err.message || "Save failed");
        });
        return;
    }

    if (Key.indexOf("http") === 0) {
        Engine.LoadSample(Key).then(function (Buf) {
            return FinishUpload(AudioBufferToWavBlob(Buf), Channel.Name);
        }).catch(function (Err) {
            if (Status) {
                Status.textContent = "Save failed";
                Status.className = "UploadStatus Err";
            }
            ShowNotice(Err.message || "Save failed");
        });
        return;
    }

    ShowNotice("Could not resolve channel audio for upload.");
}

function HandleUpload(Event) {
    var File = Event.target.files && Event.target.files[0];
    Event.target.value = "";
    if (!File) return;

    if (!State.User) {
        ShowNotice("Sign In To Upload Samples.");
        ShowModal("SignInModal");
        return;
    }

    UploadStatus.textContent = "Uploading " + File.name + "...";
    UploadStatus.className = "UploadStatus Busy";

    UploadSample(File, {
        Author: State.User.Username || State.User.DisplayName || "user",
        Name: File.name.replace(/\.[^.]+$/, ""),
        Genre: "User Upload"
    }).then(function (Result) {
        UploadStatus.textContent = "Uploaded: " + Result.Name;
        UploadStatus.className = "UploadStatus Ok";
        RefreshBrowser();
        AddChannel(Result);
    }).catch(function (Error) {
        console.error(Error);
        UploadStatus.textContent = "Upload Failed: " + Error.message;
        UploadStatus.className = "UploadStatus Err";
    });
}


globalThis.TooltipRenderers = {};

globalThis.RegisterTooltipRenderer = function (Name, Fn) {
    TooltipRenderers[Name] = Fn;
};

globalThis.TooltipSystem = {
    El: null,
    TextEl: null,
    CanvasEl: null,
    Visible: false,
    Timer: null,
    Source: null,
    Delay: 380,
    Offset: 12,

    EnsureDom: function () {
        if (this.El) return;
        var Root = document.createElement("div");
        Root.id = "AppTooltip";
        Root.className = "AppTooltip";
        Root.setAttribute("role", "tooltip");
        Root.style.display = "none";

        var Text = document.createElement("div");
        Text.className = "AppTooltipText";
        Root.appendChild(Text);

        var Canvas = document.createElement("canvas");
        Canvas.className = "AppTooltipCanvas";
        Canvas.style.display = "none";
        Root.appendChild(Canvas);

        document.body.appendChild(Root);
        this.El = Root;
        this.TextEl = Text;
        this.CanvasEl = Canvas;
    },

    ReadOptions: function (Target) {
        if (!Target || !Target.getAttribute) return null;
        var Text = Target.getAttribute("Tooltip");
        if (Text == null || Text === "") {
            // walk up for nested controls
            var Node = Target.parentElement;
            var Depth = 0;
            while (Node && Depth < 4) {
                if (Node.getAttribute && Node.getAttribute("Tooltip")) {
                    Target = Node;
                    Text = Node.getAttribute("Tooltip");
                    break;
                }
                Node = Node.parentElement;
                Depth++;
            }
        }
        if (Text == null || Text === "") return null;

        var Width = Target.getAttribute("Tooltip-Width");
        var Height = Target.getAttribute("Tooltip-Height");
        var Render = Target.getAttribute("Tooltip-Render");
        var Delay = Target.getAttribute("Tooltip-Delay");
        var Place = Target.getAttribute("Tooltip-Place");

        return {
            Target: Target,
            Text: Text,
            Width: Width ? Number(Width) : null,
            Height: Height ? Number(Height) : null,
            Render: Render || null,
            Delay: Delay != null ? Number(Delay) : this.Delay,
            Place: Place || "auto"
        };
    },

    Show: function (Options, ClientX, ClientY) {
        this.EnsureDom();
        if (!Options) return;

        this.Source = Options.Target;
        this.TextEl.textContent = Options.Text || "";
        this.TextEl.style.display = Options.Text ? "block" : "none";

        var HasCanvas = false;
        if (Options.Render && TooltipRenderers[Options.Render]) {
            HasCanvas = true;
            this.CanvasEl.style.display = "block";
            var W = Options.Width || 160;
            var H = Options.Height || 48;
            var Dpr = window.devicePixelRatio || 1;
            this.CanvasEl.width = Math.floor(W * Dpr);
            this.CanvasEl.height = Math.floor(H * Dpr);
            this.CanvasEl.style.width = W + "px";
            this.CanvasEl.style.height = H + "px";
            var Ctx = this.CanvasEl.getContext("2d");
            Ctx.setTransform(Dpr, 0, 0, Dpr, 0, 0);
            Ctx.clearRect(0, 0, W, H);
            try {
                TooltipRenderers[Options.Render](Ctx, W, H, Options.Target, Options);
            } catch (Err) {
                console.warn("Tooltip render failed", Err);
            }
        } else {
            this.CanvasEl.style.display = "none";
        }

        if (Options.Width) {
            this.El.style.width = Options.Width + "px";
            this.El.style.maxWidth = Options.Width + "px";
        } else {
            this.El.style.width = "";
            this.El.style.maxWidth = HasCanvas ? "" : "240px";
        }
        if (Options.Height) {
            this.El.style.minHeight = Options.Height + "px";
        } else {
            this.El.style.minHeight = "";
        }

        this.El.style.display = "block";
        this.El.classList.add("Visible");
        this.Visible = true;
        this.Position(ClientX, ClientY, Options.Place);
    },

    Position: function (ClientX, ClientY, Place) {
        if (!this.El) return;
        var Pad = 8;
        var Rect = this.El.getBoundingClientRect();
        var X = ClientX + this.Offset;
        var Y = ClientY + this.Offset;

        if (Place === "top") {
            X = ClientX - Rect.width / 2;
            Y = ClientY - Rect.height - this.Offset;
        } else if (Place === "bottom") {
            X = ClientX - Rect.width / 2;
            Y = ClientY + this.Offset;
        } else if (Place === "left") {
            X = ClientX - Rect.width - this.Offset;
            Y = ClientY - Rect.height / 2;
        } else if (Place === "right") {
            X = ClientX + this.Offset;
            Y = ClientY - Rect.height / 2;
        }

        if (X + Rect.width > window.innerWidth - Pad) {
            X = ClientX - Rect.width - this.Offset;
        }
        if (X < Pad) X = Pad;
        if (Y + Rect.height > window.innerHeight - Pad) {
            Y = ClientY - Rect.height - this.Offset;
        }
        if (Y < Pad) Y = Pad;

        this.El.style.left = Math.round(X) + "px";
        this.El.style.top = Math.round(Y) + "px";
    },

    Hide: function () {
        if (this.Timer) {
            clearTimeout(this.Timer);
            this.Timer = null;
        }
        this.Source = null;
        this.Visible = false;
        if (this.El) {
            this.El.classList.remove("Visible");
            this.El.style.display = "none";
        }
    },

    Schedule: function (Options, ClientX, ClientY) {
        var Self = this;
        if (this.Timer) clearTimeout(this.Timer);
        this.Timer = setTimeout(function () {
            Self.Show(Options, ClientX, ClientY);
        }, Options.Delay != null ? Options.Delay : Self.Delay);
    },

    ConvertTitleAttributes: function (Root) {
        var Scope = Root || document;
        var Nodes = Scope.querySelectorAll("[title]");
        var Index;
        for (Index = 0; Index < Nodes.length; Index++) {
            var Node = Nodes[Index];
            if (!Node.getAttribute("Tooltip")) {
                Node.setAttribute("Tooltip", Node.getAttribute("title"));
            }
            Node.removeAttribute("title");
        }
    },

    Bind: function () {
        var Self = this;
        this.EnsureDom();
        this.ConvertTitleAttributes(document);

        document.addEventListener("pointerover", function (Event) {
            var Options = Self.ReadOptions(Event.target);
            if (!Options) return;
            if (Self.Source === Options.Target && Self.Visible) return;
            Self.Schedule(Options, Event.clientX, Event.clientY);
        }, true);

        document.addEventListener("pointermove", function (Event) {
            if (!Self.Visible) {
                if (Self.Timer && Self.Source) {
                    // keep scheduled position fresh
                }
                return;
            }
            var Options = Self.ReadOptions(Event.target);
            if (!Options || Options.Target !== Self.Source) return;
            Self.Position(Event.clientX, Event.clientY, Options.Place);
        }, true);

        document.addEventListener("pointerout", function (Event) {
            var Related = Event.relatedTarget;
            if (Self.Source && Related && Self.Source.contains && Self.Source.contains(Related)) {
                return;
            }
            if (Self.El && Related && Self.El.contains(Related)) return;
            Self.Hide();
        }, true);

        document.addEventListener("pointerdown", function () {
            Self.Hide();
        }, true);

        document.addEventListener("keydown", function (Event) {
            if (Event.code === "Escape") Self.Hide();
        }, true);

        window.addEventListener("scroll", function () {
            Self.Hide();
        }, true);

        // Convert titles added later (channel buttons, etc.)
        var Observer = new MutationObserver(function (Mutations) {
            var M;
            for (M = 0; M < Mutations.length; M++) {
                if (Mutations[M].type === "attributes" && Mutations[M].attributeName === "title") {
                    var T = Mutations[M].target;
                    if (T.getAttribute && T.getAttribute("title")) {
                        if (!T.getAttribute("Tooltip")) {
                            T.setAttribute("Tooltip", T.getAttribute("title"));
                        }
                        T.removeAttribute("title");
                    }
                }
                if (Mutations[M].addedNodes && Mutations[M].addedNodes.length) {
                    Self.ConvertTitleAttributes(document);
                }
            }
        });
        Observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ["title"]
        });
    }
};

globalThis.SetTooltip = function (Element, Text, Options) {
    if (!Element) return;
    Options = Options || {};
    Element.setAttribute("Tooltip", Text || "");
    if (Options.Width != null) Element.setAttribute("Tooltip-Width", String(Options.Width));
    if (Options.Height != null) Element.setAttribute("Tooltip-Height", String(Options.Height));
    if (Options.Render) Element.setAttribute("Tooltip-Render", Options.Render);
    if (Options.Delay != null) Element.setAttribute("Tooltip-Delay", String(Options.Delay));
    if (Options.Place) Element.setAttribute("Tooltip-Place", Options.Place);
    Element.removeAttribute("title");
};

// Built-in canvas tooltip: mini waveform for elements with data-sample-url or sample peaks
RegisterTooltipRenderer("waveform", function (Ctx, W, H, Target) {
    Ctx.fillStyle = "#0c0c0c";
    Ctx.fillRect(0, 0, W, H);
    Ctx.strokeStyle = "#ff6a00";
    Ctx.beginPath();
    var Peaks = Target && Target._TooltipPeaks;
    var Index;
    if (Peaks && Peaks.length) {
        for (Index = 0; Index < Peaks.length; Index++) {
            var X = (Index / (Peaks.length - 1)) * W;
            var Amp = Peaks[Index] * (H * 0.4);
            Ctx.moveTo(X, H / 2 - Amp);
            Ctx.lineTo(X, H / 2 + Amp);
        }
    } else {
        for (Index = 0; Index < W; Index++) {
            var Y = H / 2 + Math.sin(Index * 0.12) * (H * 0.25) * Math.sin(Index * 0.03);
            if (Index === 0) Ctx.moveTo(Index, Y);
            else Ctx.lineTo(Index, Y);
        }
    }
    Ctx.stroke();
});

RegisterTooltipRenderer("meter", function (Ctx, W, H) {
    Ctx.fillStyle = "#0c0c0c";
    Ctx.fillRect(0, 0, W, H);
    var Level = 0.35 + Math.random() * 0.4;
    Ctx.fillStyle = "#ff6a00";
    Ctx.fillRect(4, 4, (W - 8) * Level, H - 8);
    Ctx.strokeStyle = "#333";
    Ctx.strokeRect(4.5, 4.5, W - 9, H - 9);
});


function Init() {
    RefreshDomRefs();
    if (!TimelineCanvas || !TimelineCtx) {
        console.error("DOM not ready");
        return;
    }
    document.addEventListener("selectstart", function (Event) {
        var Tag = Event.target && Event.target.tagName;
        if (Tag === "INPUT" || Tag === "TEXTAREA" || Tag === "SELECT") return;
        if (Event.target && Event.target.closest && Event.target.closest("#PianoRollModal")) return;
        Event.preventDefault();
    });
    if (!globalThis.Gui || typeof Gui.InitBindings !== "function") {
        console.error("Gui.js not loaded");
        return;
    }
    if (!globalThis.TooltipSystem) {
        console.error("TooltipSystem missing");
        return;
    }
    Gui.InitBindings();
}

function Boot() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", Init);
    } else {
        Init();
    }
}