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
    TotalBeats: 64,
    WaveformPeaks: null,
    WaveformSampleUrl: null,
    FollowPlayhead: true,
    ActiveVoices: {},
    PianoOctave: 4,
    Recording: false,
    RecordArm: {},
    SelectedNote: null,
    NoteDrag: null,
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

var TempoInput = document.querySelector("input.Tempo");
var TempoBubble = document.querySelector("div.TempoBubble");
var TimeLabel = document.querySelector("span.TimeLabel");
var PlayButton = document.querySelector("img.PlayButton");
var StopButton = document.querySelector("img.StopButton");
var ChannelList = document.querySelector("#ChannelList");
var PlaylistBody = document.querySelector("#PlaylistBody");
var Playlist = document.querySelector("#Playlist");
var SampleList = document.querySelector("#SampleList");
var BrowserSearch = document.querySelector("#BrowserSearch");
var UploadStatus = document.querySelector("#UploadStatus");
var SignInButton = document.querySelector("#SignInButton");
var UserChip = document.querySelector("#UserChip");
var ProfileImg = document.querySelector("#ProfileImg");
var DisplayNameLabel = document.querySelector("#DisplayNameLabel");
var DockLeft = document.querySelector("#DockLeft");
var DockRight = document.querySelector("#DockRight");
var DragGhost = document.querySelector("#DragGhost");

var TimelineCanvas = document.querySelector("#TimelineCanvas");
var TimelineCtx = TimelineCanvas.getContext("2d");
var RulerCanvas = document.querySelector("#RulerCanvas");
var RulerCtx = RulerCanvas.getContext("2d");
var WaveformCanvas = document.querySelector("#WaveformCanvas");
var WaveformCtx = WaveformCanvas.getContext("2d");

var LastTimestamp = 0;
var FlashTimer = null;
var FlashDurationMs = 64;

function QueryAll(Selector, Root) {
    return Array.prototype.slice.call((Root || document).querySelectorAll(Selector));
}

function ShowModal(Id) {
    document.querySelector("#" + Id).style.display = "flex";
}

function HideModal(Id) {
    document.querySelector("#" + Id).style.display = "none";
}

var ConfirmCallback = null;

function ShowConfirmModal(Message, OnConfirm, Options) {
    Options = Options || {};
    var MsgEl = document.querySelector("#ConfirmMessage");
    var TitleEl = document.querySelector("#ConfirmTitle");
    var OkBtn = document.querySelector("#ConfirmOk");
    if (MsgEl) MsgEl.textContent = Message || "Are you sure?";
    if (TitleEl) TitleEl.textContent = Options.Title || "Confirm";
    if (OkBtn) OkBtn.textContent = Options.OkLabel || "Delete";
    ConfirmCallback = OnConfirm || null;
    ShowModal("ConfirmModal");
}

function ShowNotice(Message, Title) {
    var MsgEl = document.querySelector("#NoticeMessage");
    var TitleEl = document.querySelector("#NoticeTitle");
    if (MsgEl) MsgEl.textContent = Message || "";
    if (TitleEl) TitleEl.textContent = Title || "Notice";
    ShowModal("NoticeModal");
}

function BindConfirmModal() {
    var OkBtn = document.querySelector("#ConfirmOk");
    var CancelBtn = document.querySelector("#ConfirmCancel");
    var Overlay = document.querySelector("#ConfirmModal");
    var NoticeOk = document.querySelector("#NoticeOk");
    var NoticeOverlay = document.querySelector("#NoticeModal");

    if (OkBtn) {
        OkBtn.addEventListener("click", function () {
            HideModal("ConfirmModal");
            if (ConfirmCallback) {
                var Fn = ConfirmCallback;
                ConfirmCallback = null;
                Fn();
            }
        });
    }

    if (CancelBtn) {
        CancelBtn.addEventListener("click", function () {
            ConfirmCallback = null;
            HideModal("ConfirmModal");
        });
    }

    if (Overlay) {
        Overlay.addEventListener("mousedown", function (Event) {
            if (Event.target === Overlay) {
                ConfirmCallback = null;
                HideModal("ConfirmModal");
            }
        });
    }

    if (NoticeOk) {
        NoticeOk.addEventListener("click", function () {
            HideModal("NoticeModal");
        });
    }
    if (NoticeOverlay) {
        NoticeOverlay.addEventListener("mousedown", function (Event) {
            if (Event.target === NoticeOverlay) HideModal("NoticeModal");
        });
    }

    var PromptOk = document.querySelector("#PromptOk");
    var PromptCancel = document.querySelector("#PromptCancel");
    var PromptOverlay = document.querySelector("#PromptModal");
    var PromptInput = document.querySelector("#PromptInput");

    function ResolvePrompt(Ok) {
        var Fn = PromptCallback;
        var Value = PromptInput ? PromptInput.value : "";
        PromptCallback = null;
        HideModal("PromptModal");
        if (Ok && Fn) Fn(Value);
        else if (!Ok && PromptCancelCallback) {
            var C = PromptCancelCallback;
            PromptCancelCallback = null;
            C();
        }
    }

    if (PromptOk) {
        PromptOk.addEventListener("click", function () { ResolvePrompt(true); });
    }
    if (PromptCancel) {
        PromptCancel.addEventListener("click", function () { ResolvePrompt(false); });
    }
    if (PromptInput) {
        PromptInput.addEventListener("keydown", function (Event) {
            if (Event.key === "Enter") {
                Event.preventDefault();
                ResolvePrompt(true);
            }
            if (Event.key === "Escape") {
                Event.preventDefault();
                ResolvePrompt(false);
            }
        });
    }
    if (PromptOverlay) {
        PromptOverlay.addEventListener("mousedown", function (Event) {
            if (Event.target === PromptOverlay) ResolvePrompt(false);
        });
    }
}

var PromptCallback = null;
var PromptCancelCallback = null;

function ShowPromptModal(Options) {
    Options = Options || {};
    var TitleEl = document.querySelector("#PromptTitle");
    var LabelEl = document.querySelector("#PromptLabel");
    var InputEl = document.querySelector("#PromptInput");
    if (TitleEl) TitleEl.textContent = Options.Title || "Rename";
    if (LabelEl) LabelEl.textContent = Options.Label || "Name";
    if (InputEl) {
        InputEl.value = Options.Value != null ? String(Options.Value) : "";
        setTimeout(function () {
            InputEl.focus();
            InputEl.select();
        }, 30);
    }
    PromptCallback = Options.OnConfirm || null;
    PromptCancelCallback = Options.OnCancel || null;
    ShowModal("PromptModal");
}

function BindAuthUi() {
    var CloseButtons = QueryAll(".CloseModal");
    var Index;

    for (Index = 0; Index < CloseButtons.length; Index++) {
        BindCloseButton(CloseButtons[Index]);
    }

    var ShowRegister = document.querySelector("#ShowRegister");
    if (ShowRegister) {
        ShowRegister.addEventListener("click", function (Event) {
            Event.preventDefault();
            HideModal("SignInModal");
            ShowModal("RegisterModal");
        });
    }

    var ShowLogin = document.querySelector("#ShowLogin");
    if (ShowLogin) {
        ShowLogin.addEventListener("click", function (Event) {
            Event.preventDefault();
            HideModal("RegisterModal");
            ShowModal("SignInModal");
        });
    }

    SignInButton.addEventListener("click", function () {
        ShowModal("SignInModal");
    });

    document.querySelector("#LoginSubmit").addEventListener("click", HandleLogin);
    document.querySelector("#RegisterSubmit").addEventListener("click", HandleRegister);

    document.querySelector("#SignOutButton").addEventListener("click", function () {
        State.User = null;
        localStorage.removeItem("OsUser");
        UpdateAuthUi();
    });
}

function BindCloseButton(Btn) {
    Btn.addEventListener("click", function () {
        HideModal(Btn.getAttribute("data-modal"));
    });
}

function HandleLogin() {
    var Username = document.querySelector("#LoginUsername").value.trim();
    var Password = document.querySelector("#LoginPassword").value;
    var ErrEl = document.querySelector("#LoginError");

    ErrEl.textContent = "";

    SignIn(Username, Password).then(function (User) {
        SetUser(User);
        HideModal("SignInModal");
    }).catch(function (Error) {
        ErrEl.textContent = Error.message || "Sign In Failed";
    });
}

function HandleRegister() {
    var Username = document.querySelector("#RegUsername").value.trim();
    var DisplayName = document.querySelector("#RegDisplayName").value.trim();
    var Password = document.querySelector("#RegPassword").value;
    var Image = document.querySelector("#RegImage").value.trim();
    var ErrEl = document.querySelector("#RegError");

    ErrEl.textContent = "";

    if (!Username || !Password) {
        ErrEl.textContent = "Username And Password Required";
        return;
    }

    RegisterAccount({
        Username: Username,
        Password: Password,
        DisplayName: DisplayName,
        Image: Image
    }).then(function (User) {
        SetUser(User);
        HideModal("RegisterModal");
    }).catch(function (Error) {
        ErrEl.textContent = Error.message || "Registration Failed";
    });
}

function SetUser(User) {
    State.User = User;
    localStorage.setItem("OsUser", JSON.stringify({
        Id: User.Id,
        Username: User.Username,
        DisplayName: User.DisplayName,
        Image: User.Image
    }));
    UpdateAuthUi();
}

function UpdateAuthUi() {
    if (State.User) {
        SignInButton.style.display = "none";
        UserChip.style.display = "flex";
        DisplayNameLabel.textContent = State.User.DisplayName || State.User.Username;
        if (ProfileImg) {
            ProfileImg.style.display = "block";
            ProfileImg.src = State.User.Image || "Assets/Images/Account.svg";
            ProfileImg.onerror = function () {
                ProfileImg.onerror = null;
                ProfileImg.src = "Assets/Images/Account.svg";
            };
        }
    } else {
        SignInButton.style.display = "flex";
        UserChip.style.display = "none";
    }
}

function BindProfileImageChange() {
    var Input = document.querySelector("#ProfileImageInput");
    if (!ProfileImg || !Input) return;

    ProfileImg.style.cursor = "pointer";
    ProfileImg.title = "Change profile image";

    ProfileImg.addEventListener("click", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        if (!State.User) return;
        Input.click();
    });

    Input.addEventListener("change", function () {
        var File = Input.files && Input.files[0];
        Input.value = "";
        if (!File || !State.User) return;
        if (!File.type || File.type.indexOf("image/") !== 0) {
            ShowNotice("Please choose an image file.");
            return;
        }
        if (File.size > 1.5 * 1024 * 1024) {
            ShowNotice("Image too large (max 1.5 MB).");
            return;
        }
        var Reader = new FileReader();
        Reader.onload = function () {
            var DataUrl = String(Reader.result || "");
            if (!DataUrl) return;
            var AccountId = State.User.Id;
            if (!AccountId) {
                State.User.Image = DataUrl;
                SetUser(State.User);
                return;
            }
            UpdateAccount(AccountId, { Image: DataUrl }).then(function () {
                State.User.Image = DataUrl;
                SetUser(State.User);
            }).catch(function (Err) {
                ShowNotice(Err.message || "Could not update profile image");
            });
        };
        Reader.readAsDataURL(File);
    });
}

function RestoreSession() {
    try {
        var Saved = JSON.parse(localStorage.getItem("OsUser") || "null");
        if (Saved && Saved.Username) State.User = Saved;
    } catch (Ignore) {}
    UpdateAuthUi();

    try {
        var DockW = JSON.parse(localStorage.getItem("OsDocks") || "null");
        if (DockW) {
            if (DockW.Left) DockLeft.style.width = DockW.Left + "px";
            if (DockW.Right) DockRight.style.width = DockW.Right + "px";
        }
    } catch (Ignore) {}
}

function SaveDockWidths() {
    var Lw = DockLeft.classList.contains("Collapsed") ? null : DockLeft.offsetWidth;
    var Rw = DockRight.classList.contains("Collapsed") ? null : DockRight.offsetWidth;
    localStorage.setItem("OsDocks", JSON.stringify({
        Left: Lw || parseInt(localStorage.getItem("OsDockLeft") || "200", 10),
        Right: Rw || parseInt(localStorage.getItem("OsDockRight") || "240", 10)
    }));
    if (Lw && Lw > 40) {
        try { localStorage.setItem("OsDockLeft", String(Lw)); } catch (_) {}
    }
    if (Rw && Rw > 40) {
        try { localStorage.setItem("OsDockRight", String(Rw)); } catch (_) {}
    }
}

function BindDocks() {
    var Handles = QueryAll(".DockResize");
    var Index;

    for (Index = 0; Index < Handles.length; Index++) {
        BindDockHandle(Handles[Index]);
    }

    window.addEventListener("mousemove", function (Event) {
        if (!State.DockResize) return;

        var Side = State.DockResize.Side;
        var StartX = State.DockResize.StartX;
        var StartW = State.DockResize.StartW;
        var Dx = Event.clientX - StartX;
        var Next;

        if (Side === "left") {
            Next = Math.min(480, Math.max(120, StartW + Dx));
            DockLeft.style.width = Next + "px";
        } else {
            Next = Math.min(480, Math.max(120, StartW - Dx));
            DockRight.style.width = Next + "px";
        }

        ResizeCanvases();
    });

    window.addEventListener("mouseup", function () {
        if (State.DockResize) {
            State.DockResize.Dock.classList.remove("Resizing");
            State.DockResize = null;
            SaveDockWidths();
            ResizeCanvases();
        }
    });
}

function BindDockHandle(Handle) {
    Handle.addEventListener("mousedown", function (Event) {
        Event.preventDefault();
        var Side = Handle.getAttribute("data-side");
        var Dock = Side === "left" ? DockLeft : DockRight;

        Dock.classList.add("Resizing");
        State.DockResize = {
            Side: Side,
            Dock: Dock,
            StartX: Event.clientX,
            StartW: Dock.offsetWidth
        };
    });
}

function UpdateRecordUi() {
    var RecBtn = document.querySelector("#RecordButton");
    if (RecBtn) {
        RecBtn.classList.toggle("Active", !!State.Recording);
    }
}

function UpdatePlayIcon() {
    if (State.Simulation.Playing) {
        PlayButton.setAttribute("src", "Assets/Images/Pause.svg");
    } else {
        PlayButton.setAttribute("src", "Assets/Images/Play.svg");
    }
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

function StartPlaybackFromPlayhead() {
    Engine.EnsureCtx();
    Engine.SetBpm(Number(TempoInput.value) || 120);

    function DoStart() {
        State.TransportGeneration = (State.TransportGeneration || 0) + 1;
        State.Simulation.Playing = true;
        UpdatePlayIcon();
        return PreloadTransportAssets().then(function () {
            if (!State.Simulation.Playing) return;
            var SongTime = State.Simulation.Time;
            Engine.ScheduleClips(CollectClips(), SongTime);
            Engine.ScheduleSteps(CollectSteps(), SongTime);
            ScheduleRecordedNotes(SongTime);
            Engine.ScheduleMetronome(SongTime, State.TotalBeats);
            DrawAll();
        });
    }

    if (Engine.PreRollEnabled && !State.Simulation.Playing) {
        return new Promise(function (Resolve) {
            Engine.PlayPreRoll(function () {
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
                PlaybackRate: Rate
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

    Bars = Math.ceil(State.TotalBeats / 4);

    for (ChannelIndex = 0; ChannelIndex < State.Channels.length; ChannelIndex++) {
        Channel = State.Channels[ChannelIndex];
        if (Channel.Muted) continue;
        Channel.Pattern = NormalizePattern(Channel.Pattern);
        var HasStep = false;
        var Si;
        for (Si = 0; Si < 16; Si++) {
            if (Channel.Pattern[Si]) { HasStep = true; break; }
        }
        if (!HasStep) continue;

        Buffer = Engine.Buffers.get(Channel.SampleUrl);
        Rate = 1;
        if (Channel.SyncToTempo && Buffer && Channel.SampleBpm) {
            Rate = Engine.Bpm / Channel.SampleBpm;
        }

        for (Bar = 0; Bar < Bars; Bar++) {
            for (Step = 0; Step < 16; Step++) {
                if (!Channel.Pattern[Step]) continue;
                Out.push({
                    Url: Channel.SampleUrl,
                    Beat: Bar * 4 + Step * 0.25,
                    Gain: Channel.Gain == null ? 1 : Channel.Gain,
                    PlaybackRate: Rate
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
    Engine.SetBpm(Number(TempoInput.value) || 120);
    var SongTime = Engine.GetSongTime();
    State.Simulation.Time = SongTime;
    Engine.StopSources();
    Engine.StartCtxTime = Engine.Ctx.currentTime;
    Engine.StartSongTime = SongTime;
    Engine.Playing = true;
    Engine.ScheduleClips(CollectClips(), SongTime);
    Engine.ScheduleSteps(CollectSteps(), SongTime);
    ScheduleRecordedNotes(SongTime);
    Engine.ScheduleMetronome(SongTime, State.TotalBeats);
}

function BindTransport() {
    PlayButton.addEventListener("click", TogglePlay);
    StopButton.addEventListener("click", StopTransport);

    document.addEventListener("keydown", function (Event) {
        if (Event.code !== "Space") return;
        var Tag = document.activeElement && document.activeElement.tagName;
        if (Tag === "INPUT" || Tag === "TEXTAREA") return;
        Event.preventDefault();
        TogglePlay();
    });

    var NumberInputs = document.querySelectorAll('input[type="number"]');
    var Index;
    for (Index = 0; Index < NumberInputs.length; Index++) {
        BindNumberInput(NumberInputs[Index]);
    }
}

function BindNumberInput(El) {
    function HandleChange() {
        var Min = El.hasAttribute("min") ? Number(El.getAttribute("min")) : -Infinity;
        var Max = El.hasAttribute("max") ? Number(El.getAttribute("max")) : Infinity;
        var Raw = Number(El.value);
        var Value = isNaN(Raw) ? Min : Math.min(Math.max(Raw, Min), Max);
        El.value = Value;
        El.setAttribute("value", Value);
        if (El.classList.contains("Tempo")) {
            Engine.SetBpm(Value);
            if (State.Simulation.Playing) {
                RescheduleTransport();
            }
        }
        El.blur();
    }

    El.addEventListener("blur", HandleChange);
    El.addEventListener("keydown", function (Event) {
        if (Event.key === "Enter") HandleChange();
    });
}

function Loop(Timestamp) {
    if (!LastTimestamp) LastTimestamp = Timestamp;
    var Delta = (Timestamp - LastTimestamp) / 1000;
    LastTimestamp = Timestamp;

    if (State.Simulation.Playing) {
        State.Simulation.Time = Engine.GetSongTime();
        if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
        var CurrentBpm = Math.max(Number(TempoInput.value) || 1, 1);
        var BeatsPerSecond = CurrentBpm / 60;
        var PrevBeat = Math.floor((State.Simulation.Time - Delta) * BeatsPerSecond);
        var CurrBeat = Math.floor(State.Simulation.Time * BeatsPerSecond);

        if (CurrBeat > PrevBeat) {
            TempoBubble.classList.add("Flash");
            clearTimeout(FlashTimer);
            FlashTimer = setTimeout(function () {
                TempoBubble.classList.remove("Flash");
            }, FlashDurationMs);
        }

        if (State.FollowPlayhead) {
            ScrollPlaylistToPlayhead();
        }
    }

    var TotalSeconds = State.Simulation.Time;
    var Minutes = String(Math.floor(TotalSeconds / 60)).padStart(2, "0");
    var Seconds = String(Math.floor(TotalSeconds % 60)).padStart(2, "0");
    var Ms = String(Math.floor((TotalSeconds % 1) * 1000)).padStart(3, "0");
    TimeLabel.textContent = Minutes + ":" + Seconds + "," + Ms;

    DrawAll();
    requestAnimationFrame(Loop);
}

function ScrollPlaylistToPlayhead() {
    var PlayX = Engine.SecondsToBeats(State.Simulation.Time) * State.PixelsPerBeat;
    var ViewW = PlaylistBody.clientWidth;
    var Target = PlayX - ViewW * 0.35;
    if (Target < 0) Target = 0;
    PlaylistBody.scrollLeft = Target;
}

function DrawAll() {
    DrawTimeline();
    DrawRuler();
    DrawWaveform();
}

function ResizeCanvases() {
    var Dpr = window.devicePixelRatio || 1;
    var BodyWidth = PlaylistBody.clientWidth;
    var BodyHeight = PlaylistBody.clientHeight;
    var ContentWidth = Math.max(BodyWidth, State.TotalBeats * State.PixelsPerBeat);
    var ContentHeight = Math.max(BodyHeight, State.Channels.length * State.TrackHeight + 8);

    TimelineCanvas.width = ContentWidth * Dpr;
    TimelineCanvas.height = ContentHeight * Dpr;
    TimelineCanvas.style.width = ContentWidth + "px";
    TimelineCanvas.style.height = ContentHeight + "px";
    TimelineCtx.setTransform(Dpr, 0, 0, Dpr, 0, 0);

    var RulerParent = RulerCanvas.parentElement;
    var RulerWidth = Math.max(RulerParent.clientWidth, ContentWidth);
    RulerCanvas.width = RulerWidth * Dpr;
    RulerCanvas.height = 26 * Dpr;
    RulerCanvas.style.width = RulerWidth + "px";
    RulerCanvas.style.height = "26px";
    RulerCtx.setTransform(Dpr, 0, 0, Dpr, 0, 0);

    var WaveCssW = WaveformCanvas.parentElement.clientWidth || 280;
    var WaveCssH = WaveformCanvas.parentElement.clientHeight || 32;
    WaveformCanvas.width = WaveCssW * Dpr;
    WaveformCanvas.height = WaveCssH * Dpr;
    WaveformCtx.setTransform(Dpr, 0, 0, Dpr, 0, 0);

    DrawAll();
}

function DrawRuler() {
    var Dpr = window.devicePixelRatio || 1;
    var Width = RulerCanvas.width / Dpr;
    var Height = 26;
    var Beat;
    var X;
    var IsBar;
    var PlayX;

    RulerCtx.clearRect(0, 0, Width, Height);
    RulerCtx.fillStyle = "#161616";
    RulerCtx.fillRect(0, 0, Width, Height);
    RulerCtx.font = "10px Cascadia Mono, monospace";
    RulerCtx.textBaseline = "top";

    for (Beat = 0; Beat <= State.TotalBeats; Beat++) {
        X = Beat * State.PixelsPerBeat;
        IsBar = Beat % 4 === 0;
        RulerCtx.beginPath();
        RulerCtx.moveTo(X + 0.5, IsBar ? 0 : Height * 0.5);
        RulerCtx.lineTo(X + 0.5, Height);
        RulerCtx.strokeStyle = IsBar ? "#444" : "#2a2a2a";
        RulerCtx.stroke();
        if (IsBar) {
            RulerCtx.fillStyle = "#777";
            RulerCtx.fillText(String(Beat / 4 + 1), X + 4, 3);
        }
    }

    PlayX = ClientLocalXFromBeat(Engine.SecondsToBeats(State.Simulation.Time));
    RulerCtx.fillStyle = "#ff3333";
    RulerCtx.fillRect(Math.round(PlayX) - 1, 0, 2, Height);
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

function DrawChannelNotes(Channel, LaneIndex, TrackY, Width) {
    if (!Channel.Notes || !Channel.Notes.length) return;

    var NoteH = Math.max(14, Math.min(22, State.TrackHeight * 0.28));
    var Index;
    var N;
    var X;
    var W;
    var Ny;
    var Selected;
    var Label;

    for (Index = 0; Index < Channel.Notes.length; Index++) {
        N = Channel.Notes[Index];
        if (N.DurationBeats == null || !(N.DurationBeats > 0)) N.DurationBeats = 0.25;
        if (N.Beat == null) N.Beat = 0;
        if (N.Note == null) N.Note = 60;

        X = N.Beat * State.PixelsPerBeat;
        W = Math.max(10, N.DurationBeats * State.PixelsPerBeat);
        Ny = NoteLaneY(N.Note, TrackY, State.TrackHeight);

        Selected = State.SelectedNote &&
            State.SelectedNote.ChannelId === Channel.Id &&
            State.SelectedNote.Index === Index;

        TimelineCtx.fillStyle = Selected ? "#ffe8b0" : "#ffb347";
        TimelineCtx.fillRect(X, Ny, W, NoteH);

        TimelineCtx.strokeStyle = Selected ? "#fff" : "#000";
        TimelineCtx.lineWidth = Selected ? 2 : 1;
        TimelineCtx.strokeRect(X + 0.5, Ny + 0.5, W - 1, NoteH - 1);
        TimelineCtx.lineWidth = 1;

        TimelineCtx.fillStyle = "rgba(0,0,0,0.35)";
        TimelineCtx.fillRect(X, Ny, 4, NoteH);
        TimelineCtx.fillRect(X + W - 4, Ny, 4, NoteH);

        Label = MidiNoteName(N.Note);
        TimelineCtx.fillStyle = "#111";
        TimelineCtx.font = "bold 10px Cascadia Mono, monospace";
        TimelineCtx.textBaseline = "middle";
        TimelineCtx.fillText(Label, X + 6, Ny + NoteH / 2);
    }
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

function DrawTimeline() {
    var Dpr = window.devicePixelRatio || 1;
    var Width = TimelineCanvas.width / Dpr;
    var Height = TimelineCanvas.height / Dpr;
    var Beat;
    var X;
    var IsBar;
    var Index;
    var Channel;
    var Y;
    var Clip;
    var W;
    var H;
    var Pad;
    var Buffer;
    var PlayX;
    var ClipIndex;

    TimelineCtx.clearRect(0, 0, Width, Height);
    TimelineCtx.fillStyle = "#121212";
    TimelineCtx.fillRect(0, 0, Width, Height);

    for (Beat = 0; Beat <= State.TotalBeats; Beat++) {
        X = Beat * State.PixelsPerBeat;
        IsBar = Beat % 4 === 0;
        TimelineCtx.beginPath();
        TimelineCtx.moveTo(X + 0.5, 0);
        TimelineCtx.lineTo(X + 0.5, Height);
        TimelineCtx.strokeStyle = IsBar ? "#2a2a2a" : "#1a1a1a";
        TimelineCtx.stroke();
    }

    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        Y = Index * State.TrackHeight;

        TimelineCtx.fillStyle = Index % 2 === 0 ? "#151515" : "#121212";
        TimelineCtx.fillRect(0, Y, Width, State.TrackHeight);

        TimelineCtx.strokeStyle = "#222";
        TimelineCtx.beginPath();
        TimelineCtx.moveTo(0, Y + State.TrackHeight + 0.5);
        TimelineCtx.lineTo(Width, Y + State.TrackHeight + 0.5);
        TimelineCtx.stroke();

        TimelineCtx.fillStyle = Channel.Color;
        TimelineCtx.fillRect(0, Y, 3, State.TrackHeight);

        for (ClipIndex = 0; ClipIndex < Channel.Clips.length; ClipIndex++) {
            Clip = Channel.Clips[ClipIndex];
            X = Clip.StartBeat * State.PixelsPerBeat;
            W = Math.max(4, Clip.DurationBeats * State.PixelsPerBeat);
            Pad = 3;
            H = State.TrackHeight - Pad * 2;

            TimelineCtx.fillStyle = Channel.Color;
            TimelineCtx.fillRect(X, Y + Pad, W, H);
            TimelineCtx.strokeStyle = "rgba(0,0,0,0.4)";
            TimelineCtx.strokeRect(X + 0.5, Y + Pad + 0.5, W - 1, H - 1);

            Buffer = Engine.Buffers.get(Channel.SampleUrl);
            if (Buffer) {
                DrawClipWaveform(TimelineCtx, Buffer, X + 1, Y + Pad + 1, W - 2, H - 2);
            }

            TimelineCtx.fillStyle = "rgba(0,0,0,0.45)";
            TimelineCtx.fillRect(X, Y + Pad, Math.min(W, 72), 13);
            TimelineCtx.fillStyle = "#fff";
            TimelineCtx.font = "10px Cascadia Mono, monospace";
            TimelineCtx.textBaseline = "middle";
            TimelineCtx.fillText(
                Truncate(Channel.Name, Math.floor(W / 6.5)),
                X + 3,
                Y + Pad + 6.5
            );
        }

        DrawChannelNotes(Channel, Index, Y, Width);
    }

    if (State.Channels.length === 0) {
        TimelineCtx.fillStyle = "#555";
        TimelineCtx.font = "12px Cascadia Mono, monospace";
        TimelineCtx.fillText("Add Samples From The Browser, Then Drag From The Rack Onto The Timeline.", 20, 36);
    }

    if (State.ChannelDrag && State.ChannelDrag.Active && State.ChannelDrag.OverTimeline) {
        var Px = State.ChannelDrag.PreviewBeat * State.PixelsPerBeat;
        var Py = State.ChannelDrag.PreviewLane * State.TrackHeight + 3;
        var Pw = Math.max(4, State.ChannelDrag.PreviewDur * State.PixelsPerBeat);
        var Ph = State.TrackHeight - 6;

        TimelineCtx.fillStyle = State.ChannelDrag.Channel.Color + "55";
        if (State.ChannelDrag.Channel.Color.charAt(0) !== "#") {
            TimelineCtx.fillStyle = "rgba(255, 106, 0, 0.25)";
        }
        TimelineCtx.fillRect(Px, Py, Pw, Ph);

        TimelineCtx.setLineDash([4, 3]);
        TimelineCtx.strokeStyle = State.ChannelDrag.Channel.Color || "#ff6a00";
        TimelineCtx.lineWidth = 1.5;
        TimelineCtx.strokeRect(Px + 0.5, Py + 0.5, Pw - 1, Ph - 1);
        TimelineCtx.setLineDash([]);

        TimelineCtx.fillStyle = "rgba(0,0,0,0.4)";
        TimelineCtx.fillRect(Px, Py, Math.min(Pw, 80), 14);
        TimelineCtx.fillStyle = "#fff";
        TimelineCtx.font = "10px Cascadia Mono, monospace";
        TimelineCtx.textBaseline = "middle";
        TimelineCtx.fillText(
            Truncate(State.ChannelDrag.Channel.Name, Math.floor(Pw / 6.5)),
            Px + 3,
            Py + 7
        );
    }

    PlayX = ClientLocalXFromBeat(Engine.SecondsToBeats(State.Simulation.Time));
    TimelineCtx.fillStyle = "#ff3333";
    TimelineCtx.fillRect(Math.round(PlayX) - 1, 0, 2, Height);
}

function Truncate(Text, MaxChars) {
    if (!Text) return "";
    if (Text.length <= MaxChars) return Text;
    return Text.slice(0, Math.max(0, MaxChars - 1)) + "...";
}

function DrawClipWaveform(Ctx, Buffer, X, Y, W, H) {
    if (W < 6) return;

    var Data = Buffer.getChannelData(0);
    var Step = Math.max(1, Math.floor(Data.length / W));
    var Mid = Y + H / 2;
    var Index;
    var SampleIndex;
    var Sample;
    var Amp;

    Ctx.fillStyle = "rgba(0,0,0,0.25)";
    Ctx.fillRect(X, Y, W, H);
    Ctx.strokeStyle = "rgba(255,255,255,0.55)";
    Ctx.lineWidth = 1;
    Ctx.beginPath();

    for (Index = 0; Index < W; Index++) {
        SampleIndex = Math.min(Data.length - 1, Index * Step);
        Sample = Data[SampleIndex] || 0;
        Amp = Sample * (H / 2) * 0.9;
        if (Index === 0) Ctx.moveTo(X + Index, Mid - Amp);
        else Ctx.lineTo(X + Index, Mid - Amp);
    }

    Ctx.stroke();
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

function DrawWaveform() {
    var Dpr = window.devicePixelRatio || 1;
    var Width = WaveformCanvas.width / Dpr;
    var Height = WaveformCanvas.height / Dpr;
    var Mid = Height / 2;
    var Data;
    var Index;
    var V;
    var Y;
    var SongBeats;
    var PlayX;

    WaveformCtx.clearRect(0, 0, Width, Height);
    WaveformCtx.fillStyle = "#0a0a0a";
    WaveformCtx.fillRect(0, 0, Width, Height);

    WaveformCtx.strokeStyle = "#1a1a1a";
    WaveformCtx.beginPath();
    WaveformCtx.moveTo(0, Mid);
    WaveformCtx.lineTo(Width, Mid);
    WaveformCtx.stroke();

    Engine.EnsureCtx();
    Data = Engine.GetAnalyserData();

    if (Data) {
        WaveformCtx.strokeStyle = "#ff6a00";
        WaveformCtx.lineWidth = 1.5;
        WaveformCtx.beginPath();
        for (Index = 0; Index < Width; Index++) {
            V = Data[Math.floor(Index / Width * Data.length)] / 128.0;
            Y = Mid + (V - 1) * (Height * 0.45);
            if (Index === 0) WaveformCtx.moveTo(Index, Y);
            else WaveformCtx.lineTo(Index, Y);
        }
        WaveformCtx.stroke();

        // subtle frequency bars under
        var Freq = Engine.GetFrequencyData();
        if (Freq) {
            WaveformCtx.fillStyle = "rgba(255, 106, 0, 0.15)";
            var Bars = Math.min(64, Width / 4);
            for (Index = 0; Index < Bars; Index++) {
                var Mag = Freq[Math.floor(Index / Bars * Freq.length)] / 255;
                var Bh = Mag * Height * 0.35;
                WaveformCtx.fillRect(Index * (Width / Bars), Height - Bh, Width / Bars - 1, Bh);
            }
        }
    } else {
        WaveformCtx.fillStyle = "#444";
        WaveformCtx.font = "10px Cascadia Mono, monospace";
        WaveformCtx.textBaseline = "middle";
        WaveformCtx.fillText("Output", 8, Mid);
    }

    SongBeats = Engine.SecondsToBeats(State.Simulation.Time);
    PlayX = (SongBeats / Math.max(1, State.TotalBeats)) * Width;
    WaveformCtx.fillStyle = "#ff3333";
    WaveformCtx.fillRect(PlayX - 1, 0, 2, Height);
}

function BindWaveformSeek() {
    function SeekFromEvent(Event) {
        var Rect = WaveformCanvas.getBoundingClientRect();
        var Ratio = (Event.clientX - Rect.left) / Rect.width;
        if (Ratio < 0) Ratio = 0;
        if (Ratio > 1) Ratio = 1;

        var Beat = Ratio * State.TotalBeats;
        var Seconds = Engine.BeatsToSeconds(Beat);
        var WasPlaying = State.Simulation.Playing;

        if (WasPlaying) {
            Engine.Stop();
            State.Simulation.Playing = false;
        }

        State.Simulation.Time = Seconds;

        if (WasPlaying) {
            State.Simulation.Playing = true;
            Engine.SetBpm(Number(TempoInput.value) || 120);
            Engine.ScheduleClips(CollectClips(), State.Simulation.Time);
            Engine.ScheduleSteps(CollectSteps(), State.Simulation.Time);
            UpdatePlayIcon();
        }

        if (State.FollowPlayhead) {
            ScrollPlaylistToPlayhead();
        }

        DrawAll();
    }

    WaveformCanvas.addEventListener("mousedown", function (Event) {
        Event.preventDefault();
        SeekFromEvent(Event);

        function OnMove(Ev) {
            SeekFromEvent(Ev);
        }

        function OnUp() {
            window.removeEventListener("mousemove", OnMove);
            window.removeEventListener("mouseup", OnUp);
        }

        window.addEventListener("mousemove", OnMove);
        window.addEventListener("mouseup", OnUp);
    });
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


function SeekToClientX(ClientX, FromRuler) {
    var Beat = FromRuler ? BeatFromRulerClientX(ClientX) : BeatFromClientX(ClientX);
    if (Beat < 0) Beat = 0;
    if (Beat > State.TotalBeats) Beat = State.TotalBeats;
    var Seconds = Engine.BeatsToSeconds(Beat);
    var WasPlaying = State.Simulation.Playing;

    if (WasPlaying) {
        Engine.Stop();
        State.Simulation.Playing = false;
    }

    State.Simulation.Time = Seconds;

    if (WasPlaying) {
        State.Simulation.Playing = true;
        Engine.SetBpm(Number(TempoInput.value) || 120);
        Engine.ScheduleClips(CollectClips(), Seconds);
        Engine.ScheduleSteps(CollectSteps(), Seconds);
        ScheduleRecordedNotes(Seconds);
        UpdatePlayIcon();
    }

    DrawAll();
    if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
}

function StartTimelineScrub(Event, FromRuler) {
    State.Scrubbing = true;
    TimelineCanvas.style.cursor = "ew-resize";
    RulerCanvas.style.cursor = "ew-resize";
    SeekToClientX(Event.clientX, FromRuler);

    function OnMove(Ev) {
        if (!State.Scrubbing) return;
        SeekToClientX(Ev.clientX, FromRuler);
    }

    function OnUp() {
        State.Scrubbing = false;
        TimelineCanvas.style.cursor = "crosshair";
        RulerCanvas.style.cursor = "pointer";
        window.removeEventListener("mousemove", OnMove);
        window.removeEventListener("mouseup", OnUp);
    }

    window.addEventListener("mousemove", OnMove);
    window.addEventListener("mouseup", OnUp);
}

function BindTimelineWheelScroll() {
    var Body = document.querySelector("#PlaylistBody");
    var RulerParent = RulerCanvas && RulerCanvas.parentElement;
    function OnWheel(Event) {
        // Vertical wheel -> horizontal timeline scroll (DAW style)
        var Dx = Event.deltaX;
        var Dy = Event.deltaY;
        if (Event.shiftKey || Math.abs(Dx) > Math.abs(Dy)) {
            // native-ish horizontal
            var Amount = Math.abs(Dx) > Math.abs(Dy) ? Dx : Dy;
            Body.scrollLeft += Amount;
            Event.preventDefault();
        } else if (Math.abs(Dy) > 0) {
            Body.scrollLeft += Dy;
            Event.preventDefault();
        }
        if (RulerParent) RulerParent.scrollLeft = Body.scrollLeft;
        DrawRuler();
    }
    if (Body) Body.addEventListener("wheel", OnWheel, { passive: false });
    if (TimelineCanvas) TimelineCanvas.addEventListener("wheel", OnWheel, { passive: false });
    if (RulerCanvas) RulerCanvas.addEventListener("wheel", OnWheel, { passive: false });
}

function BindTimelineEvents() {
    TimelineCanvas.addEventListener("mousedown", function (Event) {
        if (Event.button !== 0) return;
        if (State.ChannelDrag) return;

        var NoteHit = FindNoteAt(Event.clientX, Event.clientY);
        if (NoteHit) {
            State.SelectedNote = {
                ChannelId: NoteHit.ChannelId,
                Index: NoteHit.Index
            };
            State.SelectedChannelId = NoteHit.ChannelId;
            State.NoteDrag = {
                Channel: NoteHit.Channel,
                Note: NoteHit.Note,
                Index: NoteHit.Index,
                Mode: NoteHit.Mode,
                Lane: NoteHit.Lane,
                StartClientX: Event.clientX,
                StartClientY: Event.clientY,
                OriginBeat: NoteHit.Note.Beat,
                OriginDur: NoteHit.Note.DurationBeats || 0.25,
                OriginMidi: NoteHit.Note.Note
            };
            RenderChannels();
            DrawTimeline();
            return;
        }

        State.SelectedNote = null;

        var Hit = FindClipAt(Event.clientX, Event.clientY);
        if (!Hit || !Hit.Channel) return;

        if (Hit.Clip) {
            State.Drag = {
                Channel: Hit.Channel,
                Clip: Hit.Clip,
                OriginBeat: Hit.Clip.StartBeat,
                StartClientX: Event.clientX
            };
            State.SelectedChannelId = Hit.Channel.Id;
            RenderChannels();
            UpdateWaveformSource();
        } else {
            // Seek / scrub - do not create clips on single click
            StartTimelineScrub(Event);
        }
    });

    RulerCanvas.addEventListener("mousedown", function (Event) {
        if (Event.button !== 0) return;
        Event.preventDefault();
        StartTimelineScrub(Event, true);
    });


    window.addEventListener("mousemove", function (Event) {
        if (State.NoteDrag) {
            var Drag = State.NoteDrag;
            var Dx = Event.clientX - Drag.StartClientX;
            var DBeats = Dx / State.PixelsPerBeat;
            var N = Drag.Note;

            if (Drag.Mode === "move") {
                TimelineCanvas.style.cursor = "move";
                N.Beat = Math.max(0, Drag.OriginBeat + DBeats);
                N.Note = MidiFromClientY(Event.clientY, Drag.Lane);
            } else if (Drag.Mode === "resize-right") {
                TimelineCanvas.style.cursor = "ew-resize";
                N.DurationBeats = Math.max(0.05, Drag.OriginDur + DBeats);
            } else if (Drag.Mode === "resize-left") {
                TimelineCanvas.style.cursor = "ew-resize";
                var NewStart = Math.max(0, Drag.OriginBeat + DBeats);
                var End = Drag.OriginBeat + Drag.OriginDur;
                N.DurationBeats = Math.max(0.05, End - NewStart);
                N.Beat = NewStart;
            }

            DrawTimeline();
            return;
        }

        if (State.Drag) {
            TimelineCanvas.style.cursor = "grabbing";
            var Dx2 = Event.clientX - State.Drag.StartClientX;
            var DBeats2 = Dx2 / State.PixelsPerBeat;
            State.Drag.Clip.StartBeat = Math.max(0, State.Drag.OriginBeat + DBeats2);
            DrawTimeline();
            return;
        }

        if (State.ChannelDrag) {
            UpdateChannelDrag(Event);
            return;
        }

        // Hover cursors on timeline
        var NoteHit = FindNoteAt(Event.clientX, Event.clientY);
        if (NoteHit) {
            if (NoteHit.Mode === "move") TimelineCanvas.style.cursor = "move";
            else TimelineCanvas.style.cursor = "ew-resize";
        } else {
            var ClipHit = FindClipAt(Event.clientX, Event.clientY);
            if (ClipHit && ClipHit.Clip) TimelineCanvas.style.cursor = "grab";
            else TimelineCanvas.style.cursor = "crosshair";
        }
    });

    window.addEventListener("mouseup", function (Event) {
        if (State.NoteDrag) {
            State.NoteDrag = null;
            if (State.Simulation.Playing) {
                RescheduleTransport();
            }
            DrawTimeline();
        }

        if (State.Drag) {
            State.Drag = null;
            DrawTimeline();
        }

        if (State.ChannelDrag) {
            FinishChannelDrag(Event);
        }
    });

    TimelineCanvas.addEventListener("dblclick", function (Event) {
        var NoteHit = FindNoteAt(Event.clientX, Event.clientY);
        if (NoteHit) {
            OpenPianoRoll(NoteHit.ChannelId);
            return;
        }
        var Hit = FindClipAt(Event.clientX, Event.clientY);
        if (Hit && Hit.Channel) {
            if (Hit.Clip) {
                OpenPianoRoll(Hit.Channel.Id);
            } else if (Hit.Channel.SampleUrl) {
                PlaceClipOnChannel(Hit.Channel, BeatFromClientX(Event.clientX));
                DrawTimeline();
            } else {
                OpenPianoRoll(Hit.Channel.Id);
            }
        }
    });

    TimelineCanvas.addEventListener("contextmenu", function (Event) {
        Event.preventDefault();
        var NoteHit = FindNoteAt(Event.clientX, Event.clientY);
        var Next;
        var Index;
        var Hit;

        if (NoteHit) {
            Next = [];
            for (Index = 0; Index < NoteHit.Channel.Notes.length; Index++) {
                if (Index !== NoteHit.Index) Next.push(NoteHit.Channel.Notes[Index]);
            }
            NoteHit.Channel.Notes = Next;
            State.SelectedNote = null;
            if (State.Simulation.Playing) RescheduleTransport();
            DrawTimeline();
            return;
        }

        Hit = FindClipAt(Event.clientX, Event.clientY);
        if (Hit && Hit.Clip && Hit.Channel) {
            Next = [];
            for (Index = 0; Index < Hit.Channel.Clips.length; Index++) {
                if (Hit.Channel.Clips[Index].Id !== Hit.Clip.Id) {
                    Next.push(Hit.Channel.Clips[Index]);
                }
            }
            Hit.Channel.Clips = Next;
            DrawTimeline();
        }
    });
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

        Buffer = Engine.Buffers.get(Drag.Channel.SampleUrl);
        DurBeats = 4;
        if (Buffer) {
            DurBeats = Math.max(0.25, Engine.SecondsToBeats(Buffer.duration));
        }

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


function RenderStepGrid(Container, Channel) {
    Channel.Pattern = NormalizePattern(Channel.Pattern);
    Container.innerHTML = "";
    var Step;
    var Cell;
    for (Step = 0; Step < 16; Step++) {
        Cell = document.createElement("button");
        Cell.type = "button";
        Cell.className = "StepCell" + (Channel.Pattern[Step] ? " On" : "") + (Step % 4 === 0 ? " Beat" : "");
        SetTooltip(Cell, "Step " + (Step + 1));
        BindStepCell(Cell, Channel, Step);
        Container.appendChild(Cell);
    }
}

function BindStepCell(Cell, Channel, Step) {
    Cell.addEventListener("mousedown", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        Channel.Pattern = NormalizePattern(Channel.Pattern);
        Channel.Pattern[Step] = !Channel.Pattern[Step];
        Cell.classList.toggle("On", !!Channel.Pattern[Step]);
        if (Channel.Pattern[Step] && Engine.Buffers.has(Channel.SampleUrl)) {
            Engine.PlayOneShot(Channel.SampleUrl, Channel.Gain, 1);
        }
        if (State.Simulation.Playing) {
            RescheduleTransport();
        }
    });
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


function BuildPianoKeys() {
    var Host = document.querySelector("#PianoKeys");
    if (!Host) return;
    Host.innerHTML = "";

    var Pattern = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
    var Names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    var Start = State.PianoOctave * 12;
    var Total = 24;
    var Index;
    var Note;
    var Key;
    var IsBlack;
    var WhiteCount = 0;
    var WhiteIndexByNote = {};
    var Whites = document.createElement("div");
    Whites.className = "PianoWhites";
    Host.appendChild(Whites);

    for (Index = 0; Index < Total; Index++) {
        Note = Start + Index;
        IsBlack = Pattern[Index % 12] === 1;
        if (IsBlack) continue;
        WhiteIndexByNote[Note] = WhiteCount;
        Key = document.createElement("button");
        Key.type = "button";
        Key.className = "PianoKey White";
        Key.setAttribute("data-note", String(Note));
        Key.textContent = Names[Index % 12] + String(Math.floor(Note / 12));
        BindPianoKey(Key, Note);
        Whites.appendChild(Key);
        WhiteCount++;
    }

    for (Index = 0; Index < Total; Index++) {
        Note = Start + Index;
        IsBlack = Pattern[Index % 12] === 1;
        if (!IsBlack) continue;
        // Center between previous and next white keys
        var PrevWhite = Note - 1;
        while (PrevWhite >= Start && Pattern[(PrevWhite - Start) % 12] === 1) PrevWhite--;
        var WIdx = WhiteIndexByNote[PrevWhite];
        if (WIdx == null) continue;
        Key = document.createElement("button");
        Key.type = "button";
        Key.className = "PianoKey Black";
        Key.setAttribute("data-note", String(Note));
        Key.textContent = Names[Index % 12];
        // left edge of black key sits on boundary between PrevWhite and next white
        Key.style.left = ((WIdx + 1) / WhiteCount * 100) + "%";
        BindPianoKey(Key, Note);
        Host.appendChild(Key);
    }
}

function BindPianoKey(Key, Note) {
    Key.style.cursor = "pointer";

    Key.addEventListener("pointerdown", function (Event) {
        if (Event.pointerType === "mouse" && Event.button !== 0) return;
        Event.preventDefault();
        Event.stopPropagation();
        try { Key.setPointerCapture(Event.pointerId); } catch (_) {}
        NoteInputOn(Note, "mouse");
        Key.classList.add("Down");
    });

    Key.addEventListener("pointerup", function (Event) {
        Event.preventDefault();
        try { Key.releasePointerCapture(Event.pointerId); } catch (_) {}
        NoteInputOff(Note, "mouse");
        if (!State.KeyHolds[Note]) Key.classList.remove("Down");
    });

    Key.addEventListener("pointercancel", function (Event) {
        NoteInputOff(Note, "mouse");
        if (!State.KeyHolds[Note]) Key.classList.remove("Down");
    });

    Key.addEventListener("lostpointercapture", function () {
        NoteInputOff(Note, "mouse");
        if (!State.KeyHolds[Note]) Key.classList.remove("Down");
    });
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

function BindPianoPointerUp() {
    window.addEventListener("pointerup", function () {
        ReleaseAllMouseHolds();
    });
    window.addEventListener("pointercancel", function () {
        ReleaseAllMouseHolds();
    });
    window.addEventListener("blur", function () {
        ReleaseAllHolds();
    });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) ReleaseAllHolds();
    });
}


function SetPianoOctave(Oct) {
    State.PianoOctave = Math.max(0, Math.min(7, Oct));
    var OctEl = document.querySelector("#PianoOctave");
    if (OctEl) OctEl.value = State.PianoOctave;
    BuildPianoKeys();
}

function BindOctaveWheel() {
    var PianoKeys = document.querySelector("#PianoKeys");
    var PianoDock = document.querySelector("#PianoDock");
    var RollKeys = document.querySelector("#PianoRollKeys");
    var RollWrap = document.querySelector("#PianoRollGridWrap");

    function OnWheel(Event) {
        Event.preventDefault();
        var Delta = Event.deltaY > 0 ? -1 : 1;
        SetPianoOctave(State.PianoOctave + Delta);
    }

    if (PianoKeys) PianoKeys.addEventListener("wheel", OnWheel, { passive: false });
    if (PianoDock) {
        var Toolbar = PianoDock.querySelector(".PianoToolbar");
        if (Toolbar) Toolbar.addEventListener("wheel", OnWheel, { passive: false });
    }

    function OnRollWheel(Event) {
        // vertical scroll of roll is default; with shift or over keys change octave display of bottom piano
        if (Event.shiftKey) {
            Event.preventDefault();
            var Delta = Event.deltaY > 0 ? -1 : 1;
            SetPianoOctave(State.PianoOctave + Delta);
        }
    }
    if (RollKeys) RollKeys.addEventListener("wheel", OnRollWheel, { passive: false });
}

function BindKeyboard() {
    var Map = {
        KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5,
        KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
        KeyK: 12
    };

    document.addEventListener("keydown", function (Event) {
        var Tag = document.activeElement && document.activeElement.tagName;
        if (Tag === "INPUT" || Tag === "TEXTAREA" || Tag === "SELECT") return;
        if (Event.repeat) return;

        if (Event.code === "KeyZ") {
            SetPianoOctave(State.PianoOctave - 1);
            return;
        }
        if (Event.code === "KeyX") {
            SetPianoOctave(State.PianoOctave + 1);
            return;
        }

        if (Map[Event.code] == null) return;
        var Note = State.PianoOctave * 12 + Map[Event.code];
        if (State.KeyHolds[Note]) return;

        NoteInputOn(Note, "key");
        var Key = document.querySelector('.PianoKey[data-note="' + Note + '"]');
        if (Key) Key.classList.add("Down");
        var RollKey = document.querySelector('.PianoRollKey[data-note="' + Note + '"]');
        if (RollKey) RollKey.classList.add("Down");
    });

    document.addEventListener("keyup", function (Event) {
        if (Map[Event.code] == null) return;
        var Note = State.PianoOctave * 12 + Map[Event.code];
        NoteInputOff(Note, "key");
        var Key = document.querySelector('.PianoKey[data-note="' + Note + '"]');
        if (Key && !State.MouseHolds[Note]) Key.classList.remove("Down");
        var RollKey = document.querySelector('.PianoRollKey[data-note="' + Note + '"]');
        if (RollKey && !State.MouseHolds[Note]) RollKey.classList.remove("Down");
    });
}

function BindPluginMenu() {
    var Menu = document.querySelector("#PluginMenu");
    var AddBtn = document.querySelector("#AddChannelBtn");
    if (!Menu || !AddBtn) return;

    AddBtn.addEventListener("click", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        var Open = Menu.style.display === "none" || !Menu.style.display;
        Menu.style.display = Open ? "flex" : "none";
    });

    document.addEventListener("click", function (Event) {
        if (Event.target.closest("#PluginMenu") || Event.target.closest("#AddChannelBtn")) return;
        Menu.style.display = "none";
    });

    Menu.addEventListener("click", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        var Btn = Event.target.closest("button");
        if (!Btn) return;
        var PluginId = Btn.getAttribute("data-plugin");
        Menu.style.display = "none";

        if (PluginId === "sampler") {
            BrowserSearch.focus();
            return;
        }

        if (PluginId === "empty") {
            AddPluginChannel("synth");
            return;
        }

        AddPluginChannel(PluginId);
    });
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
        Plugin: Plugin,
        Notes: []
    };

    State.Channels.push(Channel);
    State.SelectedChannelId = Id;
    RenderChannels();
    ResizeCanvases();
}



function SetDockToggleIcon(Btn, Collapsed) {
    if (!Btn) return;
    var Img = Btn.querySelector("img");
    var ExpandSrc = Btn.getAttribute("data-expand-src") || "Assets/Images/DockExpand.svg";
    var MinimizeSrc = Btn.getAttribute("data-minimize-src") || "Assets/Images/DockMinimize.svg";
    var Src = Collapsed ? ExpandSrc : MinimizeSrc;
    if (Img) {
        Img.src = Src;
        Img.alt = Collapsed ? "Expand" : "Minimize";
    } else {
        Btn.innerHTML = '<img src="' + Src + '" alt="' + (Collapsed ? "Expand" : "Minimize") + '">';
        Btn.classList.add("IconImageBtn");
    }
    Btn.title = Collapsed ? "Expand" : "Collapse";
}

function BindDockCollapse() {
    var Left = document.querySelector("#DockLeft");
    var Right = document.querySelector("#DockRight");
    var ToggleLeft = document.querySelector("#ToggleLeftDock");
    var ToggleRight = document.querySelector("#ToggleRightDock");
    var TogglePiano = document.querySelector("#TogglePianoDock");

    function ReadDockWidthPx(Dock, Fallback) {
        var W = Dock.offsetWidth || 0;
        if (!W || Dock.classList.contains("Collapsed")) {
            var Cs = window.getComputedStyle(Dock);
            W = parseInt(Cs.width, 10) || Fallback;
        }
        return Math.max(120, Math.min(480, W || Fallback));
    }

    function FormatWidth(Px) {
        var N = parseInt(Px, 10);
        if (!isFinite(N) || N <= 40) N = 240;
        return N + "px";
    }

    function ApplyCollapsed(Dock, Collapsed, Side) {
        if (!Dock) return;
        if (Collapsed) {
            if (Side === "left" || Side === "right") {
                if (!Dock.classList.contains("Collapsed")) {
                    var Saved = ReadDockWidthPx(Dock, Side === "left" ? 200 : 240);
                    try {
                        localStorage.setItem(Side === "left" ? "OsDockLeft" : "OsDockRight", String(Saved));
                    } catch (_) {}
                }
            }
            Dock.classList.add("Collapsed");
            if (Side === "left" || Side === "right") {
                Dock.style.width = "36px";
                Dock.style.minWidth = "36px";
                Dock.style.maxWidth = "36px";
            }
        } else {
            Dock.classList.remove("Collapsed");
            if (Side === "left") {
                var Lw = FormatWidth(localStorage.getItem("OsDockLeft") || "200");
                Dock.style.width = Lw;
                Dock.style.minWidth = "";
                Dock.style.maxWidth = "";
            }
            if (Side === "right") {
                var Rw = FormatWidth(localStorage.getItem("OsDockRight") || "240");
                Dock.style.width = Rw;
                Dock.style.minWidth = "";
                Dock.style.maxWidth = "";
            }
        }
        if (Side === "left") SetDockToggleIcon(ToggleLeft, Collapsed);
        if (Side === "right") SetDockToggleIcon(ToggleRight, Collapsed);
        ResizeCanvases();
        BuildPianoKeys();
    }

    if (ToggleLeft && Left) {
        ToggleLeft.addEventListener("click", function () {
            var Next = !Left.classList.contains("Collapsed");
            ApplyCollapsed(Left, Next, "left");
            try { localStorage.setItem("OsLeftCollapsed", Next ? "1" : "0"); } catch (_) {}
        });
        if (localStorage.getItem("OsLeftCollapsed") === "1") ApplyCollapsed(Left, true, "left");
    }

    if (ToggleRight && Right) {
        ToggleRight.addEventListener("click", function () {
            var Next = !Right.classList.contains("Collapsed");
            ApplyCollapsed(Right, Next, "right");
            try { localStorage.setItem("OsRightCollapsed", Next ? "1" : "0"); } catch (_) {}
        });
        if (localStorage.getItem("OsRightCollapsed") === "1") ApplyCollapsed(Right, true, "right");
    }

    if (TogglePiano) {
        TogglePiano.addEventListener("click", function () {
            var Dock = document.querySelector("#PianoDock");
            if (!Dock) return;
            var WillCollapse = !Dock.classList.contains("Collapsed");
            if (WillCollapse) {
                var H = Dock.offsetHeight || 140;
                if (H > 40) {
                    try { localStorage.setItem("OsPianoH", String(H)); } catch (_) {}
                }
                Dock.classList.add("Collapsed");
                document.documentElement.style.setProperty("--PianoH", "32px");
                Dock.style.height = "32px";
            } else {
                Dock.classList.remove("Collapsed");
                var Ph = parseInt(localStorage.getItem("OsPianoH") || "140", 10);
                if (!isFinite(Ph) || Ph < 90) Ph = 140;
                document.documentElement.style.setProperty("--PianoH", Ph + "px");
                Dock.style.height = Ph + "px";
            }
            SetDockToggleIcon(TogglePiano, WillCollapse);
            ResizeCanvases();
            BuildPianoKeys();
        });
        SetDockToggleIcon(TogglePiano, !!(document.querySelector("#PianoDock") && document.querySelector("#PianoDock").classList.contains("Collapsed")));
    }
}

function BindPianoResize() {
    var Handle = document.querySelector("#PianoResize");
    var Dock = document.querySelector("#PianoDock");
    if (!Handle || !Dock) return;

    var Dragging = false;
    var StartY = 0;
    var StartH = 0;

    function ApplyPianoHeight(Next) {
        Next = Math.min(360, Math.max(90, Next));
        document.documentElement.style.setProperty("--PianoH", Next + "px");
        Dock.style.height = Next + "px";
        Dock.classList.remove("Collapsed");
        ResizeCanvases();
        BuildPianoKeys();
        return Next;
    }

    try {
        var SavedH = Number(localStorage.getItem("OsPianoH"));
        if (SavedH && isFinite(SavedH)) ApplyPianoHeight(SavedH);
    } catch (_) {}

    Handle.addEventListener("mousedown", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        Dragging = true;
        StartY = Event.clientY;
        StartH = Dock.offsetHeight || 140;
        Dock.classList.add("Resizing");
        Dock.classList.remove("Collapsed");
    });

    window.addEventListener("mousemove", function (Event) {
        if (!Dragging) return;
        var Dy = StartY - Event.clientY;
        ApplyPianoHeight(StartH + Dy);
    });

    window.addEventListener("mouseup", function () {
        if (!Dragging) return;
        Dragging = false;
        Dock.classList.remove("Resizing");
        try {
            localStorage.setItem("OsPianoH", String(Dock.offsetHeight || 140));
        } catch (_) {}
    });
}

function BindPianoToolbar() {
    var SynthBtn = document.querySelector("#PianoSynthMenuBtn");
    var SynthPanel = document.querySelector("#PianoSynthPanel");
    if (SynthBtn && SynthPanel) {
        SynthBtn.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            var Open = SynthPanel.style.display === "none" || !SynthPanel.style.display;
            SynthPanel.style.display = Open ? "flex" : "none";
            SynthBtn.classList.toggle("Active", Open);
        });
        SynthPanel.addEventListener("click", function (Event) {
            Event.stopPropagation();
        });
        document.addEventListener("click", function (Event) {
            if (Event.target.closest && Event.target.closest("#PianoSynthMenuWrap")) return;
            SynthPanel.style.display = "none";
            SynthBtn.classList.remove("Active");
        });
    }

    var Oct = document.querySelector("#PianoOctave");
    if (Oct) {
        Oct.addEventListener("change", function () {
            State.PianoOctave = Math.max(0, Math.min(7, Number(Oct.value) || 4));
            Oct.value = State.PianoOctave;
            BuildPianoKeys();
        });
    }

    var RecBtn = document.querySelector("#RecordButton");
    if (RecBtn) {
        RecBtn.addEventListener("click", function () {
            ToggleRecord();
        });
    }

    var EditNotesBtn = document.querySelector("#OpenPianoRollBtn");
    if (EditNotesBtn) {
        EditNotesBtn.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            var Ch = GetSelectedChannel();
            if (!Ch) {
                ShowNotice("Select a channel first.");
                return;
            }
            OpenPianoRoll(Ch.Id);
        });
    }

    var ClearNotesBtn = document.querySelector("#ClearNotesBtn");
    if (ClearNotesBtn) {
        ClearNotesBtn.addEventListener("click", function () {
            var Channel = GetSelectedChannel();
            if (Channel) {
                Channel.Notes = [];
                DrawTimeline();
                if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
            }
        });
    }

    var Controls = ["PluginWave", "PianoAtk", "PianoDec", "PianoSus", "PianoRel", "PianoCut", "PianoGlide"];
    var Index;
    for (Index = 0; Index < Controls.length; Index++) {
        (function (Id) {
            var El = document.querySelector("#" + Id);
            if (!El) return;
            El.addEventListener("input", function () {
                var Channel = GetSelectedChannel();
                if (Channel) ApplyPianoSettingsToPlugin(GetChannelPlugin(Channel));
            });
        })(Controls[Index]);
    }
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
            Gain: Channel.Gain == null ? 1 : Channel.Gain
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

function UpdatePublishLabel() {
    var Btn = document.querySelector("#PublishBtn");
    if (!Btn) return;
    var IsOwn = false;
    if (State.ProjectId && State.User) {
        var Username = State.User.Username || State.User.DisplayName || "";
        var Index;
        for (Index = 0; Index < (State.Projects || []).length; Index++) {
            var P = State.Projects[Index];
            if (P && P.Id === State.ProjectId && String(P.Author) === String(Username)) {
                IsOwn = true;
                break;
            }
        }
        if (!IsOwn && State.ProjectId) IsOwn = true;
    }
    if (State.ProjectId && IsOwn) {
        Btn.textContent = "Save";
        Btn.title = "Save project to cloud";
    } else {
        Btn.textContent = "Save";
        Btn.title = "Save project to cloud";
    }
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
            Gain: Raw.Gain == null ? 1 : Raw.Gain
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

function OpenNoteGraphEditor(ChannelId, NoteIndex) {
    var Channel = null;
    var Index;
    for (Index = 0; Index < State.Channels.length; Index++) {
        if (State.Channels[Index].Id === ChannelId) {
            Channel = State.Channels[Index];
            break;
        }
    }
    if (!Channel || !Channel.Notes || !Channel.Notes[NoteIndex]) return;

    State.SelectedNote = { ChannelId: ChannelId, Index: NoteIndex };
    EnsureNoteEvents(Channel.Notes[NoteIndex]);

    var Panel = document.querySelector("#NoteGraphPanel");
    if (Panel) {
        Panel.style.display = "flex";
        Panel.classList.add("Visible");
    }

    var Title = document.querySelector("#NoteGraphTitle");
    if (Title) {
        var Nn = Channel.Notes[NoteIndex];
        Title.textContent = "Note " + MidiNoteName(Nn.Note) + " @ " +
            (Math.round((Nn.Beat || 0) * 100) / 100);
    }

    UpdateNoteInspector();
    DrawPianoRoll();
    requestAnimationFrame(function () {
        DrawEventGraph();
    });
}

function CloseNoteGraphPanel() {
    var Panel = document.querySelector("#NoteGraphPanel");
    if (Panel) {
        Panel.style.display = "none";
        Panel.classList.remove("Visible");
    }
}

function DrawEventGraph() {
    var Canvas = document.querySelector("#EventGraphCanvas");
    if (!Canvas) return;
    var Ctx = Canvas.getContext("2d");
    var Dpr = window.devicePixelRatio || 1;
    var Wrap = document.querySelector("#EventGraphWrap");
    var W = (Wrap && Wrap.clientWidth) ? Wrap.clientWidth : 400;
    var H = (Wrap && Wrap.clientHeight) ? Wrap.clientHeight : 90;
    if (H < 40) H = 90;

    Canvas.width = Math.max(1, Math.floor(W * Dpr));
    Canvas.height = Math.max(1, Math.floor(H * Dpr));
    Canvas.style.width = W + "px";
    Canvas.style.height = H + "px";
    Ctx.setTransform(Dpr, 0, 0, Dpr, 0, 0);

    Ctx.fillStyle = "#0c0c0c";
    Ctx.fillRect(0, 0, W, H);
    Ctx.strokeStyle = "#222";
    Ctx.beginPath();
    Ctx.moveTo(0, H / 2);
    Ctx.lineTo(W, H / 2);
    Ctx.stroke();

    var Channel = GetPianoRollChannel();
    var N = null;
    if (State.SelectedNote && Channel && Channel.Notes &&
        Channel.Id === State.SelectedNote.ChannelId) {
        N = Channel.Notes[State.SelectedNote.Index];
    }
    if (!N) {
        Ctx.fillStyle = "#555";
        Ctx.font = "11px Cascadia Mono, monospace";
        Ctx.fillText("Select or double-click a note", 10, H / 2 + 4);
        return;
    }

    EnsureNoteEvents(N);
    var Param = (State.PianoRoll && State.PianoRoll.EventGraphParam) || "Cutoff";
    if (!N.Events[Param]) N.Events[Param] = [{ t: 0, v: 0.5 }];
    var Points = N.Events[Param].slice().sort(function (A, B) { return A.t - B.t; });
    N.Events[Param] = Points;

    Ctx.strokeStyle = "#ff6a00";
    Ctx.lineWidth = 1.5;
    Ctx.beginPath();
    var Index;
    for (Index = 0; Index < Points.length; Index++) {
        var X = Points[Index].t * W;
        var Y = (1 - Points[Index].v) * (H - 8) + 4;
        if (Index === 0) Ctx.moveTo(X, Y);
        else Ctx.lineTo(X, Y);
    }
    Ctx.stroke();

    var Hover = (State.PianoRoll && State.PianoRoll.GraphHoverIndex != null) ? State.PianoRoll.GraphHoverIndex : -1;
    for (Index = 0; Index < Points.length; Index++) {
        var Px = Points[Index].t * W;
        var Py = (1 - Points[Index].v) * (H - 8) + 4;
        var IsHover = Index === Hover || (State.PianoRoll && State.PianoRoll.GraphDrag && State.PianoRoll.GraphDrag.Index === Index);
        Ctx.fillStyle = IsHover ? "#ffffff" : "#ffe0a0";
        Ctx.beginPath();
        Ctx.arc(Px, Py, IsHover ? 7 : 5, 0, Math.PI * 2);
        Ctx.fill();
        Ctx.strokeStyle = IsHover ? "#ff6a00" : "#000";
        Ctx.lineWidth = IsHover ? 2 : 1;
        Ctx.stroke();
    }

    Ctx.fillStyle = "#888";
    Ctx.font = "10px Cascadia Mono, monospace";
    Ctx.fillText(Param + (Hover >= 0 ? " · point " + (Hover + 1) : " · click add"), 6, 12);
}

function BindEventGraph() {
    var Canvas = document.querySelector("#EventGraphCanvas");
    var Select = document.querySelector("#EventGraphParam");
    var ResetBtn = document.querySelector("#EventGraphReset");
    var CloseGraph = document.querySelector("#NoteGraphClose");

    if (CloseGraph) {
        CloseGraph.onclick = function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            CloseNoteGraphPanel();
        };
    }

    if (Select) {
        Select.onchange = function () {
            if (!State.PianoRoll) return;
            State.PianoRoll.EventGraphParam = Select.value;
            DrawEventGraph();
        };
    }

    if (ResetBtn) {
        ResetBtn.onclick = function () {
            var Channel = GetPianoRollChannel();
            if (!Channel || !State.SelectedNote) return;
            var N = Channel.Notes[State.SelectedNote.Index];
            if (!N) return;
            EnsureNoteEvents(N);
            var Param = State.PianoRoll.EventGraphParam || "Cutoff";
            N.Events[Param] = [{ t: 0, v: 0.5 }];
            if (Param === "Cutoff") N.FilterHz = 200 + 0.25 * 12000;
            if (Param === "Mix") N.Mix = 0.5;
            if (Param === "Glide") N.Glide = 0.25;
            if (Param === "Pan") N.Pan = 0;
            if (Param === "Resonance") N.Resonance = 1;
            DrawEventGraph();
        };
    }

    if (!Canvas) return;

    function HitTestPoint(ClientX, ClientY) {
        var Channel = GetPianoRollChannel();
        if (!Channel || !State.SelectedNote) return -1;
        var N = Channel.Notes[State.SelectedNote.Index];
        if (!N) return -1;
        EnsureNoteEvents(N);
        var Param = (State.PianoRoll && State.PianoRoll.EventGraphParam) || "Cutoff";
        if (!N.Events[Param]) return -1;
        var Points = N.Events[Param];
        var Rect = Canvas.getBoundingClientRect();
        var X = ClientX - Rect.left;
        var Y = ClientY - Rect.top;
        var W = Math.max(1, Rect.width);
        var H = Math.max(1, Rect.height);
        var Index;
        for (Index = 0; Index < Points.length; Index++) {
            var Px = Points[Index].t * W;
            var Py = (1 - Points[Index].v) * (H - 8) + 4;
            if (Math.hypot(Px - X, Py - Y) < 12) return Index;
        }
        return -1;
    }

    Canvas.oncontextmenu = function (Event) {
        Event.preventDefault();
    };

    Canvas.addEventListener("mousemove", function (Event) {
        if (State.PianoRoll && State.PianoRoll.GraphDrag) {
            Canvas.style.cursor = "grabbing";
            return;
        }
        var Hit = HitTestPoint(Event.clientX, Event.clientY);
        if (State.PianoRoll) State.PianoRoll.GraphHoverIndex = Hit;
        Canvas.style.cursor = Hit >= 0 ? "grab" : "crosshair";
        if (Hit >= 0) Canvas.title = "Drag point · Right-click delete";
        else Canvas.title = "Click to add automation point";
        DrawEventGraph();
    });

    Canvas.addEventListener("mouseleave", function () {
        if (State.PianoRoll) State.PianoRoll.GraphHoverIndex = -1;
        Canvas.style.cursor = "crosshair";
        DrawEventGraph();
    });

    Canvas.onmousedown = function (Event) {

        Event.preventDefault();
        Event.stopPropagation();
        var Channel = GetPianoRollChannel();
        if (!Channel || !State.SelectedNote) return;
        var N = Channel.Notes[State.SelectedNote.Index];
        if (!N) return;
        EnsureNoteEvents(N);
        var Param = State.PianoRoll.EventGraphParam || "Cutoff";
        if (!N.Events[Param]) N.Events[Param] = [{ t: 0, v: 0.5 }];
        var Points = N.Events[Param];
        var Rect = Canvas.getBoundingClientRect();
        var X = Event.clientX - Rect.left;
        var Y = Event.clientY - Rect.top;
        var W = Math.max(1, Rect.width);
        var H = Math.max(1, Rect.height);
        var T = Math.max(0, Math.min(1, X / W));
        var V = Math.max(0, Math.min(1, 1 - (Y - 4) / Math.max(1, H - 8)));

        var Hit = -1;
        var Index;
        for (Index = 0; Index < Points.length; Index++) {
            var Px = Points[Index].t * W;
            var Py = (1 - Points[Index].v) * (H - 8) + 4;
            if (Math.hypot(Px - X, Py - Y) < 12) {
                Hit = Index;
                break;
            }
        }

        if (Event.button === 2) {
            if (Hit >= 0 && Points.length > 1) {
                Points.splice(Hit, 1);
                DrawEventGraph();
            }
            return;
        }

        if (Hit < 0) {
            Points.push({ t: T, v: V });
            Points.sort(function (A, B) { return A.t - B.t; });
            Hit = 0;
            for (Index = 0; Index < Points.length; Index++) {
                if (Math.abs(Points[Index].t - T) < 0.03) {
                    Hit = Index;
                    break;
                }
            }
        }

        State.PianoRoll.GraphDrag = { Param: Param, Index: Hit, Note: N };

        function OnMove(Ev) {
            if (!State.PianoRoll.GraphDrag) return;
            var R = Canvas.getBoundingClientRect();
            var Pt = N.Events[State.PianoRoll.GraphDrag.Param][State.PianoRoll.GraphDrag.Index];
            if (!Pt) return;
            Pt.t = Math.max(0, Math.min(1, (Ev.clientX - R.left) / Math.max(1, R.width)));
            Pt.v = Math.max(0, Math.min(1, 1 - (Ev.clientY - R.top - 4) / Math.max(1, R.height - 8)));
            var Zero = SampleEventValue(N.Events[Param], 0);
            if (Param === "Cutoff") N.FilterHz = 200 + Math.pow(Zero, 2) * 12000;
            if (Param === "Mix") N.Mix = Zero;
            if (Param === "Glide") N.Glide = Zero * 0.5;
            if (Param === "Pan") N.Pan = Zero * 2 - 1;
            if (Param === "Resonance") N.Resonance = 0.1 + Zero * 20;
            DrawEventGraph();
        }

        function OnUp() {
            State.PianoRoll.GraphDrag = null;
            window.removeEventListener("mousemove", OnMove);
            window.removeEventListener("mouseup", OnUp);
            if (State.Simulation.Playing) RescheduleTransport();
        }

        window.addEventListener("mousemove", OnMove);
        window.addEventListener("mouseup", OnUp);
        DrawEventGraph();
    };
}

function UpdateNoteInspector() {
    var Info = document.querySelector("#NoteInspectorInfo");
    var Vel = document.querySelector("#NoteVel");
    var Len = document.querySelector("#NoteLen");
    var Channel = GetPianoRollChannel();
    var N = null;

    if (State.SelectedNote && Channel && Channel.Notes &&
        Channel.Id === State.SelectedNote.ChannelId) {
        N = Channel.Notes[State.SelectedNote.Index];
    }

    if (!N) {
        if (Info) Info.textContent = "No note selected";
        return;
    }

    if (Info) {
        Info.textContent = MidiNoteName(N.Note) + " @ " +
            (Math.round((N.Beat || 0) * 100) / 100) + " beats";
    }
    if (Vel) Vel.value = Math.round((N.Velocity == null ? 0.8 : N.Velocity) * 100);
    if (Len) Len.value = Math.max(1, Math.round((N.DurationBeats || 0.25) * 16));
}

function BindNoteInspector() {
    var Vel = document.querySelector("#NoteVel");
    var Len = document.querySelector("#NoteLen");

    function Apply() {
        var Channel = GetPianoRollChannel();
        if (!Channel || !State.SelectedNote || Channel.Id !== State.SelectedNote.ChannelId) return;
        var N = Channel.Notes[State.SelectedNote.Index];
        if (!N) return;
        if (Vel) N.Velocity = Number(Vel.value) / 100;
        if (Len) N.DurationBeats = Math.max(0.03125, Number(Len.value) / 16);
        DrawPianoRoll();
        DrawTimeline();
        UpdateNoteInspector();
    }

    if (Vel) Vel.oninput = Apply;
    if (Len) Len.oninput = Apply;
}

function OpenPianoRoll(ChannelId) {
    var Channel = null;
    var Index;
    for (Index = 0; Index < State.Channels.length; Index++) {
        if (State.Channels[Index].Id === ChannelId) {
            Channel = State.Channels[Index];
            break;
        }
    }
    if (!Channel) Channel = GetSelectedChannel();
    if (!Channel) {
        ShowNotice("Select a channel first.");
        return;
    }

    if (!Channel.Notes) Channel.Notes = [];

    State.SelectedChannelId = Channel.Id;
    State.PianoRoll.Open = true;
    State.PianoRoll.ChannelId = Channel.Id;
    State.PianoRoll.Drag = null;
    State.PianoRoll.GraphDrag = null;

    var Title = document.querySelector("#PianoRollTitle");
    if (Title) Title.textContent = "Piano Roll - " + Channel.Name;

    var Modal = document.querySelector("#PianoRollModal");
    if (!Modal) {
        console.error("PianoRollModal missing");
        return;
    }
    Modal.style.display = "flex";
    Modal.style.pointerEvents = "auto";
    Modal.style.zIndex = "5000";

    requestAnimationFrame(function () {
        BuildPianoRollKeys();
        ResizePianoRollCanvas();
        DrawPianoRoll();
        DrawEventGraph();
    });
}

function ClosePianoRoll() {
    if (typeof ReleaseAllMouseHolds === "function") ReleaseAllMouseHolds();
    State.PianoRoll.Open = false;
    State.PianoRoll.Drag = null;
    State.PianoRoll.GraphDrag = null;
    CloseNoteGraphPanel();
    var Modal = document.querySelector("#PianoRollModal");
    if (Modal) {
        Modal.style.display = "none";
    }
    DrawTimeline();
}

function BuildPianoRollKeys() {
    var Host = document.querySelector("#PianoRollKeys");
    if (!Host) return;
    Host.innerHTML = "";

    var Names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    var Pattern = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
    var Midi;

    for (Midi = State.PianoRoll.HighMidi; Midi >= State.PianoRoll.LowMidi; Midi--) {
        (function (NoteNum) {
            var IsBlack = Pattern[NoteNum % 12] === 1;
            var Key = document.createElement("div");
            Key.className = "PianoRollKey " + (IsBlack ? "Black" : "White");
            Key.setAttribute("data-note", String(NoteNum));
            Key.style.height = State.PianoRoll.RowH + "px";
            Key.textContent = Names[NoteNum % 12] + String(Math.floor(NoteNum / 12));
            Key.addEventListener("pointerdown", function (Event) {
                Event.preventDefault();
                Event.stopPropagation();
                try { Key.setPointerCapture(Event.pointerId); } catch (_) {}
                NoteInputOn(NoteNum, "mouse");
                Key.classList.add("Down");
            });
            Key.addEventListener("pointerup", function () {
                NoteInputOff(NoteNum, "mouse");
                if (!State.KeyHolds[NoteNum]) Key.classList.remove("Down");
            });
            Key.addEventListener("pointercancel", function () {
                NoteInputOff(NoteNum, "mouse");
                if (!State.KeyHolds[NoteNum]) Key.classList.remove("Down");
            });
            Host.appendChild(Key);
        })(Midi);
    }

    Host.onscroll = function () {
        var Wrap = document.querySelector("#PianoRollGridWrap");
        if (Wrap) Wrap.scrollTop = Host.scrollTop;
    };
}

function ResizePianoRollCanvas() {
    var Wrap = document.querySelector("#PianoRollGridWrap");
    var Canvas = document.querySelector("#PianoRollCanvas");
    if (!Wrap || !Canvas) return;

    var Dpr = window.devicePixelRatio || 1;
    var Rows = State.PianoRoll.HighMidi - State.PianoRoll.LowMidi + 1;
    var Height = Rows * State.PianoRoll.RowH;
    var Width = Math.max(Wrap.clientWidth || 400, State.TotalBeats * State.PianoRoll.PixelsPerBeat);

    Canvas.width = Math.floor(Width * Dpr);
    Canvas.height = Math.floor(Height * Dpr);
    Canvas.style.width = Width + "px";
    Canvas.style.height = Height + "px";
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

function DrawPianoRoll() {
    var Canvas = document.querySelector("#PianoRollCanvas");
    if (!Canvas) return;
    var Ctx = Canvas.getContext("2d");
    var Dpr = window.devicePixelRatio || 1;
    var Width = Canvas.width / Dpr;
    var Height = Canvas.height / Dpr;
    var Channel = GetPianoRollChannel();
    var Beat;
    var Midi;
    var X;
    var Y;
    var IsBar;
    var IsBlack;
    var Pattern = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
    var Index;
    var N;
    var W;
    var PlayX;
    var RowH = State.PianoRoll.RowH;
    var Ppb = State.PianoRoll.PixelsPerBeat;

    Ctx.setTransform(Dpr, 0, 0, Dpr, 0, 0);
    Ctx.clearRect(0, 0, Width, Height);
    Ctx.fillStyle = "#0e0e0e";
    Ctx.fillRect(0, 0, Width, Height);

    for (Midi = State.PianoRoll.HighMidi; Midi >= State.PianoRoll.LowMidi; Midi--) {
        Y = MidiToRollY(Midi);
        IsBlack = Pattern[Midi % 12] === 1;
        Ctx.fillStyle = IsBlack ? "#121212" : "#161616";
        Ctx.fillRect(0, Y, Width, RowH);
        if (Midi % 12 === 0) {
            Ctx.fillStyle = "rgba(255,255,255,0.04)";
            Ctx.fillRect(0, Y, Width, RowH);
        }
        Ctx.strokeStyle = "#1f1f1f";
        Ctx.beginPath();
        Ctx.moveTo(0, Y + 0.5);
        Ctx.lineTo(Width, Y + 0.5);
        Ctx.stroke();
    }

    for (Beat = 0; Beat <= State.TotalBeats; Beat++) {
        X = Beat * Ppb;
        IsBar = Beat % 4 === 0;
        Ctx.beginPath();
        Ctx.moveTo(X + 0.5, 0);
        Ctx.lineTo(X + 0.5, Height);
        Ctx.strokeStyle = IsBar ? "#333" : "#1a1a1a";
        Ctx.stroke();
    }

    if (Channel && Channel.Notes) {
        for (Index = 0; Index < Channel.Notes.length; Index++) {
            N = Channel.Notes[Index];
            if (!N) continue;
            X = (N.Beat || 0) * Ppb;
            W = Math.max(6, (N.DurationBeats || 0.25) * Ppb);
            Y = MidiToRollY(N.Note) + 1;
            var Selected = State.SelectedNote &&
                State.SelectedNote.ChannelId === Channel.Id &&
                State.SelectedNote.Index === Index;
            Ctx.fillStyle = Selected ? "#ffd27a" : "#ffb347";
            Ctx.fillRect(X, Y, W, RowH - 2);
            Ctx.strokeStyle = Selected ? "#fff" : "#000";
            Ctx.lineWidth = Selected ? 2 : 1;
            Ctx.strokeRect(X + 0.5, Y + 0.5, W - 1, RowH - 3);
            Ctx.lineWidth = 1;
            Ctx.fillStyle = "#111";
            Ctx.font = "9px Cascadia Mono, monospace";
            Ctx.textBaseline = "middle";
            if (W > 16) Ctx.fillText(MidiNoteName(N.Note), X + 3, Y + (RowH - 2) / 2);
        }
    }

    PlayX = Engine.SecondsToBeats(State.Simulation.Time) * Ppb;
    Ctx.fillStyle = "#ff3333";
    Ctx.fillRect(Math.round(PlayX) - 1, 0, 2, Height);
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

function BindPianoRoll() {
    var Modal = document.querySelector("#PianoRollModal");
    var Canvas = document.querySelector("#PianoRollCanvas");
    var Wrap = document.querySelector("#PianoRollGridWrap");
    var Keys = document.querySelector("#PianoRollKeys");
    var OpenBtn = document.querySelector("#OpenPianoRollBtn");
    var CloseBtn = document.querySelector("#PianoRollClose");
    var ClearBtn = document.querySelector("#PianoRollClear");

    if (OpenBtn) {
        OpenBtn.onclick = function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            var Ch = GetSelectedChannel();
            if (!Ch) {
                ShowNotice("Select a channel first.");
                return;
            }
            OpenPianoRoll(Ch.Id);
        };
    }

    if (CloseBtn) {
        CloseBtn.onclick = function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            ClosePianoRoll();
        };
    }

    // Do not close piano roll on backdrop click - too accidental
    if (Modal) {
        Modal.onclick = function (Event) {
            Event.stopPropagation();
        };
    }

    document.addEventListener("keydown", function (Event) {
        if (!State.PianoRoll || !State.PianoRoll.Open) return;
        if (Event.code === "Escape") {
            ClosePianoRoll();
            return;
        }
        if (Event.code === "Delete" || Event.code === "Backspace") {
            var Tag = document.activeElement && document.activeElement.tagName;
            if (Tag === "INPUT" || Tag === "TEXTAREA" || Tag === "SELECT") return;
            var Channel = GetPianoRollChannel();
            if (!Channel || !State.SelectedNote || State.SelectedNote.ChannelId !== Channel.Id) return;
            Event.preventDefault();
            Channel.Notes.splice(State.SelectedNote.Index, 1);
            State.SelectedNote = null;
            CloseNoteGraphPanel();
            DrawPianoRoll();
            DrawEventGraph();
            DrawTimeline();
            if (State.Simulation.Playing) RescheduleTransport();
        }
    });

    if (ClearBtn) {
        ClearBtn.onclick = function () {
            var Channel = GetPianoRollChannel();
            if (!Channel) return;
            Channel.Notes = [];
            State.SelectedNote = null;
            CloseNoteGraphPanel();
            DrawPianoRoll();
            DrawEventGraph();
            DrawTimeline();
        };
    }

    if (Wrap && Keys) {
        Wrap.onscroll = function () {
            Keys.scrollTop = Wrap.scrollTop;
        };
    }

    if (!Canvas) return;

    Canvas.onmousedown = function (Event) {
        if (Event.button !== 0) return;
        Event.preventDefault();
        Event.stopPropagation();

        var Channel = GetPianoRollChannel();
        if (!Channel) return;
        if (!Channel.Notes) Channel.Notes = [];

        var Pos = PianoRollLocalXY(Event.clientX, Event.clientY);
        var LocalX = Pos.X;
        var LocalY = Pos.Y;
        var Hit = FindRollNoteAt(LocalX, LocalY);

        if (Hit) {
            OpenNoteGraphEditor(Channel.Id, Hit.Index);
            State.PianoRoll.Drag = {
                Type: Hit.Mode,
                Index: Hit.Index,
                OriginBeat: Hit.Note.Beat || 0,
                OriginDur: Hit.Note.DurationBeats || 0.25,
                OriginMidi: Hit.Note.Note,
                StartX: LocalX,
                StartY: LocalY
            };
            return;
        }

        // Create note
        var Beat = SnapBeat(LocalX / State.PianoRoll.PixelsPerBeat);
        var Midi = RollYToMidi(LocalY);
        var Snap = Number((document.querySelector("#PianoRollSnap") || {}).value) || 0.125;
        var CutEl = document.querySelector("#PianoCut");
        var VelEl = document.querySelector("#PianoVel");
        var FilterHz = CutEl ? 200 + Math.pow(Number(CutEl.value) / 100, 2) * 12000 : 4000;
        var Velocity = VelEl ? Number(VelEl.value) / 100 : 0.85;
        var NewNote = {
            Note: Midi,
            Beat: Math.max(0, Beat),
            Velocity: Velocity,
            DurationBeats: Snap,
            FilterHz: FilterHz
        };
        EnsureNoteEvents(NewNote);
        Channel.Notes.push(NewNote);
        OpenNoteGraphEditor(Channel.Id, Channel.Notes.length - 1);
        State.PianoRoll.Drag = {
            Type: "resize-right",
            Index: Channel.Notes.length - 1,
            OriginBeat: NewNote.Beat,
            OriginDur: Snap,
            OriginMidi: Midi,
            StartX: LocalX,
            StartY: LocalY
        };
        DrawTimeline();
    };

    window.addEventListener("mousemove", function (Event) {
        if (!State.PianoRoll || !State.PianoRoll.Open) return;
        var CanvasEl = document.querySelector("#PianoRollCanvas");
        if (!CanvasEl) return;

        var Pos = PianoRollLocalXY(Event.clientX, Event.clientY);

        if (!State.PianoRoll.Drag) {
            var Hover = FindRollNoteAt(Pos.X, Pos.Y);
            if (Hover) {
                CanvasEl.style.cursor = Hover.Mode === "move" ? "move" : "ew-resize";
            } else {
                CanvasEl.style.cursor = "crosshair";
            }
            return;
        }

        var Channel = GetPianoRollChannel();
        if (!Channel || !Channel.Notes) return;
        var Drag = State.PianoRoll.Drag;
        var N = Channel.Notes[Drag.Index];
        if (!N) return;

        var Dx = Pos.X - Drag.StartX;
        var DBeats = Dx / State.PianoRoll.PixelsPerBeat;

        if (Drag.Type === "move") {
            CanvasEl.style.cursor = "move";
            N.Beat = Math.max(0, SnapBeat(Drag.OriginBeat + DBeats));
            N.Note = RollYToMidi(Pos.Y);
        } else if (Drag.Type === "resize-right") {
            CanvasEl.style.cursor = "ew-resize";
            var Dur = SnapBeat(Drag.OriginDur + DBeats);
            N.DurationBeats = Math.max(0.03125, Dur || 0.03125);
        } else if (Drag.Type === "resize-left") {
            CanvasEl.style.cursor = "ew-resize";
            var NewStart = Math.max(0, SnapBeat(Drag.OriginBeat + DBeats));
            var End = Drag.OriginBeat + Drag.OriginDur;
            N.DurationBeats = Math.max(0.03125, End - NewStart);
            N.Beat = NewStart;
        }

        DrawPianoRoll();
        UpdateNoteInspector();
    });

    window.addEventListener("mouseup", function () {
        if (!State.PianoRoll || !State.PianoRoll.Drag) return;
        State.PianoRoll.Drag = null;
        DrawTimeline();
        DrawEventGraph();
        if (State.Simulation.Playing) RescheduleTransport();
    });

    Canvas.oncontextmenu = function (Event) {
        Event.preventDefault();
        var Pos = PianoRollLocalXY(Event.clientX, Event.clientY);
        var Hit = FindRollNoteAt(Pos.X, Pos.Y);
        var Channel = GetPianoRollChannel();
        if (!Hit || !Channel) return;
        Channel.Notes.splice(Hit.Index, 1);
        if (State.SelectedNote && State.SelectedNote.Index === Hit.Index) {
            State.SelectedNote = null;
            CloseNoteGraphPanel();
        }
        DrawPianoRoll();
        DrawEventGraph();
        DrawTimeline();
        if (State.Simulation.Playing) RescheduleTransport();
    };

    Canvas.ondblclick = function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        var Channel = GetPianoRollChannel();
        if (!Channel || !Channel.Notes) return;
        var Pos = PianoRollLocalXY(Event.clientX, Event.clientY);
        var Hit = FindRollNoteAt(Pos.X, Pos.Y);
        if (!Hit) return;
        State.PianoRoll.Drag = null;
        OpenNoteGraphEditor(Channel.Id, Hit.Index);
    };
}

function BindEffects() {
    var FilterEl = document.querySelector("#FxFilter");
    var DelayEl = document.querySelector("#FxDelay");
    var ReverbEl = document.querySelector("#FxReverb");
    var CompEl = document.querySelector("#FxComp");
    var MasterEl = document.querySelector("#FxMaster");

    if (FilterEl) {
        FilterEl.addEventListener("input", function () {
            var Hz = 40 + Math.pow(Number(FilterEl.value) / 100, 2) * 17960;
            Engine.EnsureCtx();
            Engine.SetFilterFreq(Hz);
        });
    }
    if (DelayEl) {
        DelayEl.addEventListener("input", function () {
            Engine.EnsureCtx();
            Engine.SetDelayMix(Number(DelayEl.value) / 100);
        });
    }
    if (ReverbEl) {
        ReverbEl.addEventListener("input", function () {
            Engine.EnsureCtx();
            Engine.SetReverbMix(Number(ReverbEl.value) / 100);
        });
    }
    if (CompEl) {
        CompEl.addEventListener("input", function () {
            Engine.EnsureCtx();
            var Amt = Number(CompEl.value) / 100;
            if (Engine.Compressor) {
                Engine.Compressor.threshold.value = -6 - Amt * 24;
                Engine.Compressor.ratio.value = 2 + Amt * 10;
                Engine.Compressor.knee.value = 20 - Amt * 12;
            }
        });
    }
    if (MasterEl) {
        MasterEl.addEventListener("input", function () {
            Engine.EnsureCtx();
            var V = Math.max(0, Math.min(1.2, Number(MasterEl.value) / 100));
            if (Engine.Master) {
                Engine.Master.gain.setTargetAtTime(V, Engine.Ctx.currentTime, 0.02);
            }
            var PlayVol = document.querySelector("#PlaybackVolume");
            if (PlayVol) PlayVol.value = String(Math.round(Math.min(100, V * 100)));
        });
    }
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

function RenderChannels() {
    ChannelList.innerHTML = "";
    var Index;
    var Channel;
    var Row;
    var Selected;

    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        Selected = State.SelectedChannelId === Channel.Id;
        Row = document.createElement("div");
        Row.className = "ChannelRow" + (Selected ? " Selected" : "");
        Row.setAttribute("data-id", Channel.Id);
        var GainPct = Math.round((Channel.Gain == null ? 1 : Channel.Gain) * 100);
        Row.innerHTML =
            '<div class="ChannelColor" style="background:' + Channel.Color + '"></div>' +
            '<div class="ChannelMain">' +
            '<div class="ChannelInfo">' +
            '<span class="ChannelName" title="' + Channel.Name + '">' + Channel.Name + '</span>' +
            '</div>' +
            '<div class="ChannelVolRow">' +
            '<span class="ChannelVolLabel">Vol</span>' +
            '<input type="range" class="ChannelVol" min="0" max="100" value="' + GainPct + '" title="Channel volume">' +
            '</div>' +
            '<div class="StepGrid"></div>' +
            '</div>' +
            '<button class="StretchBtn' + (Channel.StretchToClip ? ' Active' : '') + '" title="Stretch to clip length">S</button>' +
            '<button class="MuteBtn' + (Channel.Muted ? ' Active' : '') + '" title="Mute">M</button>' +
            '<button class="IconBtn IconImageBtn SaveSampleBtn" title="Save channel as sample"><img src="Assets/Images/DockExpand.svg" alt="Save sample"></button>' +
            '<button class="RemoveChannelBtn" title="Remove">x</button>';
        BindChannelRow(Row, Channel);
        RenderStepGrid(Row.querySelector(".StepGrid"), Channel);
        ChannelList.appendChild(Row);
    }
}

function BindChannelRow(Row, Channel) {
    Row.addEventListener("mousedown", function (Event) {
        if (Event.target.closest("button")) return;
        if (Event.target.closest("input")) return;
        if (Event.button !== 0) return;
        State.SelectedChannelId = Channel.Id;
        RenderChannels();
        UpdateWaveformSource();
        StartChannelDrag(Channel, Event);
    });

    var StretchBtn = Row.querySelector(".StretchBtn");
    if (StretchBtn) {
        StretchBtn.addEventListener("click", function (Event) {
            Event.stopPropagation();
            Channel.StretchToClip = !Channel.StretchToClip;
            RenderChannels();
            if (State.Simulation.Playing) RescheduleTransport();
        });
    }

    Row.querySelector(".MuteBtn").addEventListener("click", function (Event) {
        Event.stopPropagation();
        Channel.Muted = !Channel.Muted;
        RenderChannels();
        if (State.Simulation.Playing) RescheduleTransport();
    });

    Row.querySelector(".RemoveChannelBtn").addEventListener("click", function (Event) {
        Event.stopPropagation();
        var Next = [];
        var Index;
        for (Index = 0; Index < State.Channels.length; Index++) {
            if (State.Channels[Index].Id !== Channel.Id) Next.push(State.Channels[Index]);
        }
        State.Channels = Next;
        if (State.SelectedChannelId === Channel.Id) State.SelectedChannelId = null;
        RenderChannels();
        ResizeCanvases();
        UpdateWaveformSource();
    });

    Row.querySelector(".ChannelName").addEventListener("dblclick", function () {
        PlaceClipOnChannel(Channel, Engine.SecondsToBeats(State.Simulation.Time));
    });

    var VolEl = Row.querySelector(".ChannelVol");
    if (VolEl) {
        VolEl.addEventListener("mousedown", function (Event) { Event.stopPropagation(); });
        VolEl.addEventListener("click", function (Event) { Event.stopPropagation(); });
        VolEl.addEventListener("input", function (Event) {
            Event.stopPropagation();
            Channel.Gain = Math.max(0, Math.min(1, Number(VolEl.value) / 100));
            if (State.Simulation.Playing) RescheduleTransport();
        });
    }

    var SaveSampleBtn = Row.querySelector(".SaveSampleBtn");
    if (SaveSampleBtn) {
        SaveSampleBtn.addEventListener("click", function (Event) {
            Event.stopPropagation();
            SaveChannelAsSample(Channel);
        });
    }
}

function PlaceClipOnChannel(Channel, StartBeat) {
    var Buffer = Engine.Buffers.get(Channel.SampleUrl);
    var DurationBeats = 4;
    if (Buffer) DurationBeats = Math.max(0.25, Engine.SecondsToBeats(Buffer.duration));
    Channel.Clips.push({
        Id: Guid(),
        StartBeat: Math.max(0, StartBeat),
        DurationBeats: DurationBeats
    });
    DrawTimeline();
}

function SetBrowserTab(Tab) {
    State.BrowserTab = Tab || "samples";
    var SamplesTab = document.querySelector("#TabSamples");
    var ProjectsTab = document.querySelector("#TabProjects");
    var SampleToolbar = document.querySelector("#SampleToolbar");
    var ProjectToolbar = document.querySelector("#ProjectToolbar");
    var SampleListEl = document.querySelector("#SampleList");
    var ProjectListEl = document.querySelector("#ProjectList");

    if (SamplesTab) SamplesTab.classList.toggle("Active", State.BrowserTab === "samples");
    if (ProjectsTab) ProjectsTab.classList.toggle("Active", State.BrowserTab === "projects");
    if (SampleToolbar) SampleToolbar.style.display = State.BrowserTab === "samples" ? "flex" : "none";
    if (ProjectToolbar) ProjectToolbar.style.display = State.BrowserTab === "projects" ? "flex" : "none";
    if (SampleListEl) SampleListEl.style.display = State.BrowserTab === "samples" ? "" : "none";
    if (ProjectListEl) ProjectListEl.style.display = State.BrowserTab === "projects" ? "" : "none";
}

function RenderProjectList() {
    var ProjectListEl = document.querySelector("#ProjectList");
    if (!ProjectListEl) return;

    var QueryEl = document.querySelector("#ProjectSearch");
    var QueryText = (QueryEl && QueryEl.value ? QueryEl.value : "").toLowerCase().trim();
    var Filtered = [];
    var Index;
    var Project;
    var Item;
    var IsMine;
    var Username = State.User ? (State.User.Username || State.User.DisplayName || "") : "";

    for (Index = 0; Index < (State.Projects || []).length; Index++) {
        Project = State.Projects[Index];
        if (!Project) continue;
        if (QueryText) {
            var Hay = ((Project.Name || "") + " " + (Project.Author || "")).toLowerCase();
            if (Hay.indexOf(QueryText) === -1) continue;
        }
        Filtered.push(Project);
    }

    ProjectListEl.innerHTML = "";
    if (!Filtered.length) {
        ProjectListEl.innerHTML = '<div class="Empty">No projects found</div>';
        return;
    }

    for (Index = 0; Index < Filtered.length; Index++) {
        Project = Filtered[Index];
        IsMine = Username && String(Project.Author) === String(Username);
        Item = document.createElement("div");
        Item.className = "SampleItem ProjectItem";
        Item.innerHTML =
            '<div class="SampleMeta">' +
            '<span class="SampleName">' + EscapeHtml(Project.Name || "Untitled") + '</span>' +
            '<span class="SampleSub">' +
            EscapeHtml(Project.Author || "?") +
            (IsMine ? " · yours" : "") +
            " · " + ((Project.Channels && Project.Channels.length) || 0) + " ch" +
            '</span>' +
            '</div>' +
            '<div class="SampleActions">' +
            (IsMine ? '<button type="button" class="IconBtn IconImageBtn RenameProjectBtn" title="Rename project"><img src="Assets/Images/Rename.svg" alt="Rename"></button>' : "") +
            (IsMine ? '<button type="button" class="IconBtn DeleteProjectBtn" title="Delete project">x</button>' : "") +
            '</div>';
        Item.title = "Double-click to open";
        (function (Doc, Mine) {
            var Ren = Item.querySelector(".RenameProjectBtn");
            if (Ren && Mine) {
                Ren.addEventListener("click", function (Event) {
                    Event.preventDefault();
                    Event.stopPropagation();
                    ShowPromptModal({
                        Title: "Rename Project",
                        Label: "Project name",
                        Value: Doc.Name || "Untitled Project",
                        OnConfirm: function (Raw) {
                            var NextName = String(Raw || "").trim();
                            if (!NextName) return;
                            var Username = State.User ? (State.User.Username || State.User.DisplayName) : "";
                            RenameProject(Doc.Id, NextName, Username).then(function () {
                                if (State.ProjectId === Doc.Id) {
                                    var NameEl = document.querySelector("#ProjectName");
                                    if (NameEl) NameEl.value = NextName;
                                }
                                RefreshBrowser();
                            }).catch(function (Err) {
                                ShowNotice(Err.message || "Rename failed");
                            });
                        }
                    });
                });
            }
            var Del = Item.querySelector(".DeleteProjectBtn");
            if (Del && Mine) {
                Del.addEventListener("click", function (Event) {
                    Event.preventDefault();
                    Event.stopPropagation();
                    ShowConfirmModal(
                        "Delete project \"" + (Doc.Name || "Untitled") + "\"? This cannot be undone.",
                        function () {
                            DeleteProject(Doc.Id).then(function () {
                                if (State.ProjectId === Doc.Id) {
                                    State.ProjectId = null;
                                    UpdatePublishLabel();
                                }
                                RefreshBrowser();
                            }).catch(function (Err) {
                                var Status = document.querySelector("#PublishStatus");
                                if (Status) {
                                    Status.textContent = Err.message || "Delete failed";
                                }
                            });
                        }
                    )
                });
            }
            Item.addEventListener("dblclick", function () {
                OpenProjectFromBrowser(Doc);
            });
        })(Project, IsMine);
        ProjectListEl.appendChild(Item);
    }
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

function RenderSampleList() {
    var QueryText = (BrowserSearch.value || "").toLowerCase().trim();
    var Filtered = [];
    var Index;
    var Sample;
    var Item;

    for (Index = 0; Index < State.Samples.length; Index++) {
        Sample = State.Samples[Index];
        if (!QueryText) {
            Filtered.push(Sample);
            continue;
        }
        if (
            (Sample.Name || "").toLowerCase().indexOf(QueryText) !== -1 ||
            (Sample.Author || "").toLowerCase().indexOf(QueryText) !== -1 ||
            (Sample.Genre || "").toLowerCase().indexOf(QueryText) !== -1
        ) {
            Filtered.push(Sample);
        }
    }

    SampleList.innerHTML = "";
    if (Filtered.length === 0) {
        SampleList.innerHTML = '<div class="Empty">No Samples Found</div>';
        return;
    }

    for (Index = 0; Index < Filtered.length; Index++) {
        Sample = Filtered[Index];
        Item = document.createElement("div");
        Item.className = "SampleItem";
        var Username = State.User ? (State.User.Username || State.User.DisplayName || "") : "";
        var IsMine = Username && String(Sample.Author || "") === String(Username);
        Item.innerHTML =
            '<div class="SampleMeta">' +
            '<span class="SampleName">' + EscapeHtml(Sample.Name || "Untitled") + '</span>' +
            '<span class="SampleSub">' +
            EscapeHtml(Sample.Author || "?") + ' - ' + EscapeHtml(Sample.Genre || "") +
            (IsMine ? " · yours" : "") +
            '</span>' +
            '</div>' +
            '<div class="SampleActions">' +
            '<button class="IconBtn IconImageBtn PreviewBtn" title="Preview"><img src="Assets/Images/Play.svg" alt="Preview"></button>' +
            '<button class="IconBtn IconImageBtn AddBtn" title="Add To Channel Rack"><img src="Assets/Images/DockExpand.svg" alt="Add"></button>' +
            (IsMine ? '<button class="IconBtn IconImageBtn RenameSampleBtn" title="Rename sample"><img src="Assets/Images/Rename.svg" alt="Rename"></button>' : "") +
            (IsMine ? '<button class="IconBtn DeleteSampleBtn" title="Delete sample">x</button>' : "") +
            '</div>';
        BindSampleItem(Item, Sample);
        SampleList.appendChild(Item);
    }
}

function BindSampleItem(Item, Sample) {
    Item.querySelector(".AddBtn").addEventListener("click", function () {
        AddChannel(Sample);
    });

    Item.querySelector(".PreviewBtn").addEventListener("click", function () {
        Engine.LoadSample(Sample.File).then(function (Buffer) {
            Engine.EnsureCtx();
            Engine.StopSources();
            var Source = Engine.Ctx.createBufferSource();
            Source.buffer = Buffer;
            Source.connect(Engine.Master);
            Source.start();
            Engine.Sources.push(Source);
            var Index;
            for (Index = 0; Index < State.Channels.length; Index++) {
                if (State.Channels[Index].SampleUrl === Sample.File) {
                    State.Channels[Index].Peaks = BuildPeaks(Buffer, 128);
                }
            }
            DrawWaveform();
        }).catch(function (Error) {
            console.warn("Preview Failed", Error);
            ShowNotice("Could Not Preview: " + Error.message);
        });
    });

    var RenS = Item.querySelector(".RenameSampleBtn");
    if (RenS) {
        RenS.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            if (!State.User) {
                ShowNotice("Sign in to rename samples.");
                return;
            }
            ShowPromptModal({
                Title: "Rename Sample",
                Label: "Sample name",
                Value: Sample.Name || "Untitled",
                OnConfirm: function (Raw) {
                    var NextName = String(Raw || "").trim();
                    if (!NextName) return;
                    var Username = State.User.Username || State.User.DisplayName;
                    RenameSample(Sample.Id, NextName, Username).then(function () {
                        RefreshBrowser();
                    }).catch(function (Err) {
                        ShowNotice(Err.message || "Rename failed");
                    });
                }
            });
        });
    }

    var Del = Item.querySelector(".DeleteSampleBtn");
    if (Del) {
        Del.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            if (!State.User) {
                ShowNotice("Sign in to delete samples.");
                return;
            }
            ShowConfirmModal(
                "Delete sample \"" + (Sample.Name || "Untitled") + "\"? This cannot be undone.",
                function () {
                    var Username = State.User.Username || State.User.DisplayName;
                    DeleteSample(Sample.Id, Username).then(function () {
                        RefreshBrowser();
                    }).catch(function (Err) {
                        ShowNotice(Err.message || "Delete failed");
                    });
                }
            );
        });
    }
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

function BindBrowser() {
    if (BrowserSearch) BrowserSearch.addEventListener("input", RenderSampleList);
    var ProjectSearch = document.querySelector("#ProjectSearch");
    if (ProjectSearch) ProjectSearch.addEventListener("input", RenderProjectList);
    var RefreshBtn = document.querySelector("#RefreshBrowserBtn");
    if (RefreshBtn) RefreshBtn.addEventListener("click", RefreshBrowser);
    var TabSamples = document.querySelector("#TabSamples");
    var TabProjects = document.querySelector("#TabProjects");
    if (TabSamples) TabSamples.addEventListener("click", function () { SetBrowserTab("samples"); });
    if (TabProjects) TabProjects.addEventListener("click", function () { SetBrowserTab("projects"); });

    document.querySelector("#FileUpload").addEventListener("change", HandleUpload);
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


function BindPlaybackVolume() {
    var El = document.querySelector("#PlaybackVolume");
    if (!El) return;

    function Apply() {
        var V = Math.max(0, Math.min(1, Number(El.value) / 100));
        Engine.EnsureCtx();
        if (Engine.Master) {
            Engine.Master.gain.setTargetAtTime(V, Engine.Ctx.currentTime, 0.02);
        }
        // keep Effects master slider in sync if present
        var FxMaster = document.querySelector("#FxMaster");
        if (FxMaster) FxMaster.value = String(Math.round(V * 100));
    }

    El.addEventListener("input", Apply);
    // default quieter than max
    if (El.value === "" || El.value == null) El.value = "70";
    Apply();
}

function BindMetronomeUi() {
    var MetroBtn = document.querySelector("#MetronomeBtn");
    var VolEl = document.querySelector("#MetronomeVolume");
    var CountBtn = document.querySelector("#CountInBtn");
    var BeatsEl = document.querySelector("#CountInBeats");

    function SyncMetroUi() {
        if (MetroBtn) MetroBtn.classList.toggle("Active", !!Engine.MetronomeEnabled);
        if (CountBtn) CountBtn.classList.toggle("Active", !!Engine.PreRollEnabled);
        if (BeatsEl) BeatsEl.value = String(Engine.PreRollBeats || 4);
    }

    if (MetroBtn) {
        MetroBtn.addEventListener("click", function () {
            Engine.SetMetronomeEnabled(!Engine.MetronomeEnabled);
            SyncMetroUi();
            // Mute/unmute live via bus - do not reschedule stacked clicks when turning off
            if (Engine.MetronomeEnabled && State.Simulation.Playing) {
                Engine.ScheduleMetronome(Engine.GetSongTime(), State.TotalBeats);
            }
        });
    }
    if (VolEl) {
        VolEl.addEventListener("input", function () {
            Engine.SetMetronomeVolume(Number(VolEl.value) / 100);
        });
        Engine.SetMetronomeVolume(Number(VolEl.value) / 100);
    }
    if (CountBtn) {
        CountBtn.addEventListener("click", function () {
            Engine.PreRollEnabled = !Engine.PreRollEnabled;
            SyncMetroUi();
        });
    }
    if (BeatsEl) {
        function ApplyBeats() {
            var N = Math.max(1, Math.min(32, Number(BeatsEl.value) || 4));
            BeatsEl.value = String(N);
            Engine.PreRollBeats = N;
        }
        BeatsEl.addEventListener("change", ApplyBeats);
        BeatsEl.addEventListener("blur", ApplyBeats);
        ApplyBeats();
    }
    SyncMetroUi();
}

function BindMenuBar() {
    var Items = document.querySelectorAll(".MenuItem");
    var Index;
    for (Index = 0; Index < Items.length; Index++) {
        (function (Item) {
            var Label = Item.querySelector(".MenuLabel");
            if (Label) {
                Label.addEventListener("click", function (Event) {
                    Event.preventDefault();
                    Event.stopPropagation();
                    var WasOpen = Item.classList.contains("Open");
                    var All = document.querySelectorAll(".MenuItem.Open");
                    var J;
                    for (J = 0; J < All.length; J++) All[J].classList.remove("Open");
                    if (!WasOpen) Item.classList.add("Open");
                });
            }
        })(Items[Index]);
    }
    document.addEventListener("click", function (Event) {
        if (Event.target && Event.target.closest && Event.target.closest("#EffectsPanel")) return;
        var All = document.querySelectorAll(".MenuItem.Open");
        var J;
        for (J = 0; J < All.length; J++) All[J].classList.remove("Open");
    });

    var EffectsPanel = document.querySelector("#EffectsPanel");
    if (EffectsPanel) {
        EffectsPanel.addEventListener("click", function (Event) {
            Event.stopPropagation();
        });
        EffectsPanel.addEventListener("mousedown", function (Event) {
            Event.stopPropagation();
        });
    }

    function BindMenuClick(Id, Fn) {
        var El = document.querySelector("#" + Id);
        if (El) El.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            Fn();
            var All = document.querySelectorAll(".MenuItem.Open");
            var J;
            for (J = 0; J < All.length; J++) All[J].classList.remove("Open");
        });
    }

    BindMenuClick("MenuNewProject", NewEmptyProject);
    BindMenuClick("MenuSaveProject", PublishProject);
    BindMenuClick("MenuSaveAsProject", SaveProjectAs);
    BindMenuClick("MenuPublishProject", function () {
        State.ProjectId = null;
        UpdatePublishLabel();
        PublishProject();
    });
    BindMenuClick("MenuRefreshBrowser", RefreshBrowser);
    BindMenuClick("MenuClearNotes", function () {
        var Ch = GetSelectedChannel();
        if (Ch) {
            Ch.Notes = [];
            DrawTimeline();
            if (State.PianoRoll && State.PianoRoll.Open) DrawPianoRoll();
            if (State.Simulation.Playing) RescheduleTransport();
        }
    });
    BindMenuClick("MenuStopTransport", StopTransport);
    BindMenuClick("MenuToggleLeftDock", function () {
        var Btn = document.querySelector("#ToggleLeftDock");
        if (Btn) Btn.click();
    });
    BindMenuClick("MenuToggleRightDock", function () {
        var Btn = document.querySelector("#ToggleRightDock");
        if (Btn) Btn.click();
    });
    BindMenuClick("MenuTogglePiano", function () {
        var Btn = document.querySelector("#TogglePianoDock");
        if (Btn) Btn.click();
    });
    BindMenuClick("MenuToggleMetronome", function () {
        var Btn = document.querySelector("#MetronomeBtn");
        if (Btn) Btn.click();
    });
    BindMenuClick("MenuToggleCountIn", function () {
        var Btn = document.querySelector("#CountInBtn");
        if (Btn) Btn.click();
    });

    var NewBtn = document.querySelector("#NewProjectBtn");
    if (NewBtn) NewBtn.addEventListener("click", NewEmptyProject);
}

function Init() {
    document.addEventListener("selectstart", function (Event) {
        var Tag = Event.target && Event.target.tagName;
        if (Tag === "INPUT" || Tag === "TEXTAREA" || Tag === "SELECT") return;
        if (Event.target && Event.target.closest && Event.target.closest("#PianoRollModal")) return;
        Event.preventDefault();
    });

    TooltipSystem.Bind();
    BindAuthUi();
    BindConfirmModal();
    BindTransport();
    var Pub = document.querySelector("#PublishBtn");
    if (Pub) Pub.addEventListener("click", PublishProject);
    var SaveAsBtn = document.querySelector("#SaveAsBtn");
    if (SaveAsBtn) SaveAsBtn.addEventListener("click", SaveProjectAs);
    var Mic = document.querySelector("#MicButton");
    if (Mic) Mic.addEventListener("click", ToggleMicRecord);

    BindTimelineEvents();
    BindTimelineWheelScroll();
    BindBrowser();
    BindDocks();
    BindDockCollapse();
    BindMetronomeUi();
    BindPlaybackVolume();
    BindMenuBar();
    BindKeyboard();
    BindOctaveWheel();
    BindEffects();
    BindPluginMenu();
    BindPianoToolbar();
    BindPianoResize();
    BindPianoPointerUp();
    BindPianoRoll();
    BindNoteInspector();
    BindEventGraph();
    BuildPianoKeys();
    RestoreSession();
    BindProfileImageChange();
    RenderChannels();
    ResizeCanvases();
    RefreshBrowser();
    SetBrowserTab(State.BrowserTab || "samples");
    UpdatePublishLabel();

    window.addEventListener("resize", function () {
        ResizeCanvases();
        BuildPianoKeys();
        if (State.PianoRoll && State.PianoRoll.Open) {
            ResizePianoRollCanvas();
            DrawPianoRoll();
            DrawEventGraph();
        }
    });

    PlaylistBody.addEventListener("scroll", function () {
        if (RulerCanvas && RulerCanvas.parentElement) {
            RulerCanvas.parentElement.scrollLeft = PlaylistBody.scrollLeft;
        }
        DrawRuler();
    });

    setInterval(function () {
        UpdateWaveformSource();
    }, 1000);

    requestAnimationFrame(Loop);
}


// Extra safety: close handlers always bound even if BindPianoRoll early-returns
(function BindPianoRollCloseSafety() {
    var Modal = document.querySelector("#PianoRollModal");
    var CloseBtn = document.querySelector("#PianoRollClose");
    if (CloseBtn) {
        CloseBtn.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            ClosePianoRoll();
        });
    }
    document.addEventListener("keydown", function (Event) {
        if (Event.code === "Escape" && State.PianoRoll && State.PianoRoll.Open) {
            ClosePianoRoll();
        }
    });
})();

Init();