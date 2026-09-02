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



var ContextMenuTarget = null;

function HideContextMenu() {
    var Menu = document.querySelector("#AppContextMenu");
    if (Menu) {
        Menu.style.display = "none";
        Menu.innerHTML = "";
        Menu.classList.remove("Open");
    }
    ContextMenuTarget = null;
}

function ShowContextMenu(ClientX, ClientY, Items) {
    var Menu = document.querySelector("#AppContextMenu");
    if (!Menu) {
        Menu = document.createElement("div");
        Menu.id = "AppContextMenu";
        Menu.className = "ContextMenu";
        document.body.appendChild(Menu);
    }
    Menu.innerHTML = "";
    var Index;
    for (Index = 0; Index < Items.length; Index++) {
        (function (Item) {
            if (Item === "-") {
                var Sep = document.createElement("div");
                Sep.className = "CtxSep";
                Menu.appendChild(Sep);
                return;
            }
            if (Item.Colors) {
                var Row = document.createElement("div");
                Row.className = "CtxColorRow";
                var Ci;
                for (Ci = 0; Ci < Item.Colors.length; Ci++) {
                    (function (Color) {
                        var Sw = document.createElement("button");
                        Sw.type = "button";
                        Sw.className = "CtxColorSwatch";
                        Sw.style.background = Color;
                        Sw.title = Color;
                        Sw.addEventListener("click", function (Event) {
                            Event.preventDefault();
                            Event.stopPropagation();
                            HideContextMenu();
                            if (Item.OnColor) Item.OnColor(Color);
                        });
                        Row.appendChild(Sw);
                    })(Item.Colors[Ci]);
                }
                Menu.appendChild(Row);
                return;
            }
            var Btn = document.createElement("button");
            Btn.type = "button";
            Btn.className = "CtxItem" + (Item.Danger ? " Danger" : "") + (Item.Checked ? " Checked" : "");
            Btn.textContent = (Item.Checked ? "✓ " : "") + Item.Label;
            if (Item.Disabled) Btn.disabled = true;
            Btn.addEventListener("mousedown", function (Event) {
                Event.preventDefault();
                Event.stopPropagation();
            });
            Btn.addEventListener("click", function (Event) {
                Event.preventDefault();
                Event.stopPropagation();
                HideContextMenu();
                if (Item.Action) Item.Action();
            });
            Menu.appendChild(Btn);
        })(Items[Index]);
    }
    Menu.style.display = "flex";
    Menu.classList.add("Open");
    Menu.style.visibility = "hidden";
    var Pad = 6;
    var Mw = Math.max(160, Menu.offsetWidth || 180);
    var Mh = Math.max(40, Menu.offsetHeight || 120);
    var X = ClientX;
    var Y = ClientY;
    if (X + Mw > window.innerWidth - Pad) X = window.innerWidth - Mw - Pad;
    if (Y + Mh > window.innerHeight - Pad) Y = window.innerHeight - Mh - Pad;
    if (X < Pad) X = Pad;
    if (Y < Pad) Y = Pad;
    Menu.style.left = Math.round(X) + "px";
    Menu.style.top = Math.round(Y) + "px";
    Menu.style.visibility = "visible";
}

function BindContextMenuChrome() {
    document.addEventListener("mousedown", function (Event) {
        var Menu = document.querySelector("#AppContextMenu");
        if (!Menu || Menu.style.display === "none") return;
        if (Menu.contains(Event.target)) return;
        HideContextMenu();
    }, true);
    document.addEventListener("keydown", function (Event) {
        if (Event.code === "Escape") HideContextMenu();
    });
    window.addEventListener("resize", HideContextMenu);
}

function OpenChannelFxModal(Channel) {
    if (!Channel) return;
    EnsureChannelFx(Channel);
    State.SelectedChannelId = Channel.Id;
    var WidgetId = "channel-fx-" + Channel.Id;
    // Re-open existing for this channel
    if (FloatingWidgets[WidgetId] && FloatingWidgets[WidgetId].El) {
        CloseFloatingWidget(WidgetId);
    }
    CreateFloatingWidget({
        Id: WidgetId,
        Title: "FX — " + (Channel.Name || "Channel"),
        Width: 300,
        Height: 380,
        Build: function (Body) {
            EnsureChannelFx(Channel);
            Body.innerHTML =
                '<div class="FwPluginRows ChannelFxFloatRows">' +
                '<label>EQ Low <input type="range" data-fx="EqLow" min="-24" max="24" value="' + (Channel.Fx.EqLow || 0) + '"></label>' +
                '<label>EQ Mid <input type="range" data-fx="EqMid" min="-24" max="24" value="' + (Channel.Fx.EqMid || 0) + '"></label>' +
                '<label>EQ High <input type="range" data-fx="EqHigh" min="-24" max="24" value="' + (Channel.Fx.EqHigh || 0) + '"></label>' +
                '<label>Filter <input type="range" data-fx="Filter" min="0" max="100" value="' + (Channel.Fx.Filter != null ? Channel.Fx.Filter : 100) + '"></label>' +
                '<label>Delay <input type="range" data-fx="Delay" min="0" max="100" value="' + (Channel.Fx.Delay || 0) + '"></label>' +
                '<label>Reverb <input type="range" data-fx="Reverb" min="0" max="100" value="' + (Channel.Fx.Reverb || 0) + '"></label>' +
                '<label>Drive <input type="range" data-fx="Drive" min="0" max="100" value="' + (Channel.Fx.Drive || 0) + '"></label>' +
                '<label>Pan <input type="range" data-fx="Pan" data-pan="1" min="-100" max="100" value="' + Math.round((Channel.Fx.Pan || 0) * 100) + '"></label>' +
                '<button type="button" class="Button Secondary" data-fx-reset="1">Reset</button>' +
                '</div>';
            var Inputs = Body.querySelectorAll("input[data-fx]");
            var I;
            for (I = 0; I < Inputs.length; I++) {
                (function (El) {
                    El.addEventListener("input", function () {
                        EnsureChannelFx(Channel);
                        var Key = El.getAttribute("data-fx");
                        if (El.getAttribute("data-pan")) {
                            Channel.Fx.Pan = Number(El.value) / 100;
                        } else {
                            Channel.Fx[Key] = Number(El.value);
                        }
                        if (State.Simulation.Playing) RescheduleTransport();
                    });
                })(Inputs[I]);
            }
            var Reset = Body.querySelector("[data-fx-reset]");
            if (Reset) {
                Reset.addEventListener("click", function () {
                    Channel.Fx = DefaultChannelFx();
                    OpenChannelFxModal(Channel);
                    if (State.Simulation.Playing) RescheduleTransport();
                });
            }
        }
    });
}

function BindChannelFxModal() {
    // Channel FX is floating-widget based; legacy modal close still safe no-ops
    var CloseBtn = document.querySelector("#ChannelFxClose");
    if (CloseBtn) {
        CloseBtn.addEventListener("click", function () {
            HideModal("ChannelFxModal");
        });
    }
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


function BindTransport() {
    PlayButton.addEventListener("click", TogglePlay);
    StopButton.addEventListener("click", StopTransport);

    document.addEventListener("keydown", function (Event) {
        var Tag = document.activeElement && document.activeElement.tagName;
        if (Tag === "INPUT" || Tag === "TEXTAREA" || Tag === "SELECT") return;
        if (Event.code === "Space") {
            Event.preventDefault();
            TogglePlay();
            return;
        }
        if ((Event.code === "Delete" || Event.code === "Backspace") && !(State.PianoRoll && State.PianoRoll.Open)) {
            if (DeleteSelectedTimelineItems()) Event.preventDefault();
            return;
        }
        var Mod = Event.ctrlKey || Event.metaKey;
        if (Mod && !(State.PianoRoll && State.PianoRoll.Open)) {
            if (Event.code === "KeyC") {
                if (CopySelectedTimelineItems()) Event.preventDefault();
                return;
            }
            if (Event.code === "KeyX") {
                if (CutSelectedTimelineItems()) Event.preventDefault();
                return;
            }
            if (Event.code === "KeyV") {
                if (PasteClipboardItems()) Event.preventDefault();
                return;
            }
            if (Event.code === "KeyD") {
                if (DuplicateSelectedTimelineItems()) Event.preventDefault();
                return;
            }
        }
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
        TopUpStepSchedule();
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
    if (!PlaylistBody) return;
    var PlayX = Engine.SecondsToBeats(State.Simulation.Time) * State.PixelsPerBeat;
    var ViewW = PlaylistBody.clientWidth;
    var Target = PlayX - ViewW * 0.3;
    if (Target < 0) Target = 0;
    var Cur = PlaylistBody.scrollLeft;
    var Diff = Target - Cur;
    if (Math.abs(Diff) < 0.35) {
        PlaylistBody.scrollLeft = Target;
        return;
    }
    PlaylistBody.scrollLeft = Cur + Diff * 0.14;
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

        Selected = IsNoteSelected(Channel.Id, Index) || (State.SelectedNote &&
            State.SelectedNote.ChannelId === Channel.Id &&
            State.SelectedNote.Index === Index);

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
            if (IsClipSelected(Channel.Id, Clip.Id)) {
                TimelineCtx.strokeStyle = "#fff";
                TimelineCtx.lineWidth = 2;
                TimelineCtx.strokeRect(X + 0.5, Y + Pad + 0.5, W - 1, H - 1);
                TimelineCtx.lineWidth = 1;
            } else {
                TimelineCtx.strokeStyle = "rgba(0,0,0,0.4)";
                TimelineCtx.strokeRect(X + 0.5, Y + Pad + 0.5, W - 1, H - 1);
            }

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
    function SeekFromEvent(Event, Scrub) {
        var Rect = WaveformCanvas.getBoundingClientRect();
        var Ratio = (Event.clientX - Rect.left) / Rect.width;
        if (Ratio < 0) Ratio = 0;
        if (Ratio > 1) Ratio = 1;

        var Beat = Ratio * State.TotalBeats;
        var Seconds = Engine.BeatsToSeconds(Beat);
        State.Simulation.Time = Seconds;
        if (Engine.Ctx) {
            Engine.StartSongTime = Seconds;
            Engine.StartCtxTime = Engine.Ctx.currentTime;
        }
        if (State.FollowPlayhead) ScrollPlaylistToPlayhead();
        DrawAll();
    }

    WaveformCanvas.addEventListener("mousedown", function (Event) {
        Event.preventDefault();
        var Resume = !!State.Simulation.Playing;
        if (Resume) {
            HardStopAllVoices();
            State.Simulation.Playing = false;
            UpdatePlayIcon();
        }
        State.Scrubbing = true;
        SeekFromEvent(Event, true);

        function OnMove(Ev) {
            SeekFromEvent(Ev, true);
        }

        function OnUp() {
            State.Scrubbing = false;
            window.removeEventListener("mousemove", OnMove);
            window.removeEventListener("mouseup", OnUp);
            if (Resume) StartPlaybackFromPlayhead();
        }

        window.addEventListener("mousemove", OnMove);
        window.addEventListener("mouseup", OnUp);
    });
}


function BindTimelineWheelScroll() {
    var Body = document.querySelector("#PlaylistBody");
    var RulerParent = RulerCanvas && RulerCanvas.parentElement;
    var Velocity = 0;
    var Raf = 0;
    var LastTs = 0;

    function SyncRuler() {
        if (RulerParent && Body) RulerParent.scrollLeft = Body.scrollLeft;
        DrawRuler();
    }

    function Tick(Ts) {
        if (!Body) { Raf = 0; return; }
        if (!LastTs) LastTs = Ts;
        var Dt = Math.min(32, Ts - LastTs) / 16.666;
        LastTs = Ts;
        if (Math.abs(Velocity) < 0.08) {
            Velocity = 0;
            Raf = 0;
            LastTs = 0;
            SyncRuler();
            return;
        }
        Body.scrollLeft += Velocity * Dt;
        // friction
        Velocity *= Math.pow(0.86, Dt);
        SyncRuler();
        Raf = requestAnimationFrame(Tick);
    }

    function OnWheel(Event) {
        if (!Body) return;
        var Dx = Event.deltaX;
        var Dy = Event.deltaY;
        var Scale = Event.deltaMode === 1 ? 18 : Event.deltaMode === 2 ? Body.clientWidth * 0.85 : 1;
        Dx *= Scale;
        Dy *= Scale;
        var Amount = (Event.shiftKey || Math.abs(Dx) >= Math.abs(Dy))
            ? (Math.abs(Dx) > Math.abs(Dy) ? Dx : Dy)
            : Dy;
        if (!Amount) return;
        Event.preventDefault();
        // impulse into velocity (smoother than direct scroll)
        Velocity += Amount * 0.42;
        // clamp runaway
        if (Velocity > 120) Velocity = 120;
        if (Velocity < -120) Velocity = -120;
        if (!Raf) {
            LastTs = 0;
            Raf = requestAnimationFrame(Tick);
        }
    }

    if (Body) {
        Body.style.scrollBehavior = "auto";
        Body.addEventListener("wheel", OnWheel, { passive: false });
    }
    if (TimelineCanvas) TimelineCanvas.addEventListener("wheel", OnWheel, { passive: false });
    if (RulerCanvas) RulerCanvas.addEventListener("wheel", OnWheel, { passive: false });
}



function BindTimelineEvents() {
    TimelineCanvas.addEventListener("mousedown", function (Event) {
        if (Event.button !== 0) return;
        if (State.ChannelDrag) return;

        var NoteHit = FindNoteAt(Event.clientX, Event.clientY);
        if (NoteHit) {
            ToggleNoteSelection(NoteHit.ChannelId, NoteHit.Index, Event.shiftKey || Event.ctrlKey || Event.metaKey);
            State.SelectedChannelId = NoteHit.ChannelId;
            var NoteGrabBeat = BeatFromClientX(Event.clientX);
            var NoteGrabMidi = MidiFromClientY(Event.clientY, NoteHit.Lane);
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
                OriginMidi: NoteHit.Note.Note,
                GrabOffsetBeats: NoteGrabBeat - (NoteHit.Note.Beat || 0),
                GrabOffsetMidi: NoteGrabMidi - (NoteHit.Note.Note || 60),
                Origins: (State.SelectedNotes || []).map(function (Key) {
                    var P = String(Key).split(":");
                    var Ch = null;
                    var Xi;
                    for (Xi = 0; Xi < State.Channels.length; Xi++) {
                        if (State.Channels[Xi].Id === P[0]) { Ch = State.Channels[Xi]; break; }
                    }
                    if (!Ch || !Ch.Notes) return null;
                    var Nn = Ch.Notes[Number(P[1])];
                    if (!Nn) return null;
                    return { ChannelId: P[0], Index: Number(P[1]), OriginBeat: Nn.Beat, OriginMidi: Nn.Note, OriginDur: Nn.DurationBeats || 0.25 };
                }).filter(Boolean)
            };
            RenderChannels();
            DrawTimeline();
            return;
        }

        if (!(Event.shiftKey || Event.ctrlKey || Event.metaKey)) {
            ClearBulkSelection();
        }
        State.SelectedNote = null;

        var Hit = FindClipAt(Event.clientX, Event.clientY);
        if (!Hit || !Hit.Channel) return;

        if (Hit.Clip) {
            ToggleClipSelection(Hit.Channel.Id, Hit.Clip.Id, Event.shiftKey || Event.ctrlKey || Event.metaKey);
            var GrabBeat = BeatFromClientX(Event.clientX);
            State.Drag = {
                Channel: Hit.Channel,
                Clip: Hit.Clip,
                OriginBeat: Hit.Clip.StartBeat,
                GrabOffsetBeats: GrabBeat - (Hit.Clip.StartBeat || 0),
                StartClientX: Event.clientX
            };
            State.SelectedChannelId = Hit.Channel.Id;
            RenderChannels();
            UpdateWaveformSource();
            DrawTimeline();
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
            var PointerBeat = BeatFromClientX(Event.clientX);
            var PointerMidi = MidiFromClientY(Event.clientY, Drag.Lane);
            var GrabB = Drag.GrabOffsetBeats != null ? Drag.GrabOffsetBeats : 0;
            var GrabM = Drag.GrabOffsetMidi != null ? Drag.GrabOffsetMidi : 0;

            if (Drag.Mode === "move") {
                TimelineCanvas.style.cursor = "grabbing";
                var NewBeat = Math.max(0, PointerBeat - GrabB);
                var NewMidi = Math.max(0, Math.min(127, PointerMidi - GrabM));
                var DeltaBeat = NewBeat - (N.Beat || 0);
                var DeltaMidi = NewMidi - (N.Note || 60);
                N.Beat = NewBeat;
                N.Note = NewMidi;
                // move multi-selection relative to primary
                if (Drag.Origins && Drag.Origins.length > 1) {
                    var Oi;
                    for (Oi = 0; Oi < Drag.Origins.length; Oi++) {
                        var Origin = Drag.Origins[Oi];
                        if (Origin.ChannelId === Drag.Channel.Id && Origin.Index === Drag.Index) continue;
                        var Ch = null;
                        var Xi;
                        for (Xi = 0; Xi < State.Channels.length; Xi++) {
                            if (State.Channels[Xi].Id === Origin.ChannelId) { Ch = State.Channels[Xi]; break; }
                        }
                        if (!Ch || !Ch.Notes || !Ch.Notes[Origin.Index]) continue;
                        Ch.Notes[Origin.Index].Beat = Math.max(0, Origin.OriginBeat + (NewBeat - Drag.OriginBeat));
                        Ch.Notes[Origin.Index].Note = Math.max(0, Math.min(127, Origin.OriginMidi + (NewMidi - Drag.OriginMidi)));
                    }
                }
            } else if (Drag.Mode === "resize-right") {
                TimelineCanvas.style.cursor = "ew-resize";
                N.DurationBeats = Math.max(0.05, PointerBeat - (N.Beat || 0));
            } else if (Drag.Mode === "resize-left") {
                TimelineCanvas.style.cursor = "ew-resize";
                var End2 = Drag.OriginBeat + Drag.OriginDur;
                var NewStart2 = Math.max(0, PointerBeat);
                N.DurationBeats = Math.max(0.05, End2 - NewStart2);
                N.Beat = NewStart2;
            }

            DrawTimeline();
            return;
        }

        if (State.Drag) {
            TimelineCanvas.style.cursor = "grabbing";
            var GrabOff = State.Drag.GrabOffsetBeats != null ? State.Drag.GrabOffsetBeats : 0;
            var PointerBeat = BeatFromClientX(Event.clientX);
            State.Drag.Clip.StartBeat = Math.max(0, PointerBeat - GrabOff);
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
        if (Channel.Pattern[Step]) {
            var Idx = State.Channels.indexOf(Channel);
            PlayChannelStepPreview(Channel, Idx >= 0 ? Idx : 0);
        }
        if (State.Simulation.Playing) {
            RescheduleTransport();
        }
    });
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




var FloatingWidgets = {};

function EnsureFloatingLayer() {
    var Layer = document.querySelector("#FloatingLayer");
    if (!Layer) {
        Layer = document.createElement("div");
        Layer.id = "FloatingLayer";
        Layer.className = "FloatingLayer";
        document.body.appendChild(Layer);
    }
    return Layer;
}

function CloseFloatingWidget(Id) {
    var W = FloatingWidgets[Id];
    if (!W || !W.El) return;
    W.El.classList.remove("Open");
    W.El.classList.add("Closing");
    setTimeout(function () {
        if (W.El && W.El.parentNode) W.El.parentNode.removeChild(W.El);
        delete FloatingWidgets[Id];
        if (Id === "analyzer") State.AnalyzerRaf = null;
    }, 180);
}

function CreateFloatingWidget(Options) {
    Options = Options || {};
    var Id = Options.Id || ("fw-" + Date.now());
    if (FloatingWidgets[Id] && FloatingWidgets[Id].El) {
        // focus existing
        var Existing = FloatingWidgets[Id].El;
        Existing.classList.add("Open");
        Existing.style.zIndex = String(4000 + Object.keys(FloatingWidgets).length);
        return FloatingWidgets[Id];
    }
    var Layer = EnsureFloatingLayer();
    var El = document.createElement("div");
    El.className = "FloatingWidget";
    El.setAttribute("data-fw-id", Id);
    var W = Options.Width || 360;
    var H = Options.Height || 240;
    var X = Options.X != null ? Options.X : Math.max(40, (window.innerWidth - W) / 2 + (Object.keys(FloatingWidgets).length % 5) * 24);
    var Y = Options.Y != null ? Options.Y : Math.max(60, (window.innerHeight - H) / 3 + (Object.keys(FloatingWidgets).length % 5) * 24);
    El.style.width = W + "px";
    El.style.height = H + "px";
    El.style.left = X + "px";
    El.style.top = Y + "px";
    El.innerHTML =
        '<div class="FwTitleBar">' +
        '<span class="FwTitle">' + (Options.Title || "Plugin") + '</span>' +
        '<button type="button" class="FwClose" title="Close"><img src="Assets/Images/Close.png" alt="Close"></button>' +
        '</div>' +
        '<div class="FwBody"></div>' +
        '<div class="FwResize" title="Resize"></div>';
    Layer.appendChild(El);
    var Body = El.querySelector(".FwBody");
    if (Options.ContentHtml) Body.innerHTML = Options.ContentHtml;
    if (Options.Build) Options.Build(Body, El);

    var Widget = { Id: Id, El: El, Body: Body };
    FloatingWidgets[Id] = Widget;

    // Title drag with relative grab offset
    var Title = El.querySelector(".FwTitleBar");
    var DragState = null;
    Title.addEventListener("mousedown", function (Event) {
        if (Event.button !== 0) return;
        if (Event.target.closest(".FwClose")) return;
        Event.preventDefault();
        var Rect = El.getBoundingClientRect();
        DragState = {
            OffsetX: Event.clientX - Rect.left,
            OffsetY: Event.clientY - Rect.top
        };
        El.classList.add("Dragging");
        El.style.zIndex = String(5000);
    });
    window.addEventListener("mousemove", function (Event) {
        if (!DragState) return;
        var Nx = Event.clientX - DragState.OffsetX;
        var Ny = Event.clientY - DragState.OffsetY;
        Nx = Math.max(0, Math.min(window.innerWidth - 80, Nx));
        Ny = Math.max(28, Math.min(window.innerHeight - 40, Ny));
        El.style.left = Nx + "px";
        El.style.top = Ny + "px";
    });
    window.addEventListener("mouseup", function () {
        if (DragState) {
            DragState = null;
            El.classList.remove("Dragging");
        }
    });

    // Resize with relative corner grab
    var Resize = El.querySelector(".FwResize");
    var ResizeState = null;
    Resize.addEventListener("mousedown", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        var Rect = El.getBoundingClientRect();
        ResizeState = {
            StartW: Rect.width,
            StartH: Rect.height,
            StartX: Event.clientX,
            StartY: Event.clientY
        };
        El.classList.add("Resizing");
    });
    window.addEventListener("mousemove", function (Event) {
        if (!ResizeState) return;
        var Nw = Math.max(240, ResizeState.StartW + (Event.clientX - ResizeState.StartX));
        var Nh = Math.max(160, ResizeState.StartH + (Event.clientY - ResizeState.StartY));
        El.style.width = Nw + "px";
        El.style.height = Nh + "px";
        if (Options.OnResize) Options.OnResize(Widget);
    });
    window.addEventListener("mouseup", function () {
        if (ResizeState) {
            ResizeState = null;
            El.classList.remove("Resizing");
        }
    });

    El.querySelector(".FwClose").addEventListener("click", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        CloseFloatingWidget(Id);
        if (Options.OnClose) Options.OnClose();
    });

    requestAnimationFrame(function () {
        El.classList.add("Open");
    });
    return Widget;
}


function OpenMixer(SelectChannelId) {
    if (SelectChannelId) State.SelectedChannelId = SelectChannelId;
    CreateFloatingWidget({
        Id: "mixer",
        Title: "Mixer",
        Width: Math.min(900, window.innerWidth - 40),
        Height: 420,
        Build: function (Body) {
            Body.innerHTML = '<div class="MixerStrips FwMixerStrips" id="MixerStrips"></div>';
            RenderMixer();
        },
        OnResize: function () {
            // strips reflow via CSS
        }
    });
    RenderMixer();
}

function RenderMixer() {
    var Host = document.querySelector("#MixerStrips");
    if (!Host) return;
    Host.innerHTML = "";
    var Index;
    var Channel;
    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        EnsureChannelFx(Channel);
        (function (Ch, Idx) {
            var Strip = document.createElement("div");
            Strip.className = "MixerStrip" + (State.SelectedChannelId === Ch.Id ? " Selected" : "") + (Ch.Muted ? " Muted" : "");
            var GainPct = Math.round((Ch.Gain == null ? 1 : Ch.Gain) * 100);
            var PanPct = Math.round((Ch.Fx.Pan || 0) * 100);
            Strip.innerHTML =
                '<div class="MixerColor" style="background:' + Ch.Color + '"></div>' +
                '<div class="MixerName" title="' + EscapeHtml(Ch.Name) + '">' + EscapeHtml(Ch.Name) + '</div>' +
                '<label class="MixerKnob">Low<input type="range" min="-24" max="24" value="' + (Ch.Fx.EqLow || 0) + '" data-eq="EqLow"></label>' +
                '<label class="MixerKnob">Mid<input type="range" min="-24" max="24" value="' + (Ch.Fx.EqMid || 0) + '" data-eq="EqMid"></label>' +
                '<label class="MixerKnob">High<input type="range" min="-24" max="24" value="' + (Ch.Fx.EqHigh || 0) + '" data-eq="EqHigh"></label>' +
                '<label class="MixerKnob">Filter<input type="range" min="0" max="100" value="' + (Ch.Fx.Filter || 100) + '" data-fx="Filter"></label>' +
                '<label class="MixerKnob">Pan<input type="range" min="-100" max="100" value="' + PanPct + '" data-pan="1"></label>' +
                '<input type="range" class="MixerFader" min="0" max="100" value="' + GainPct + '" orient="vertical" title="Volume">' +
                '<div class="MixerFaderVal">' + GainPct + '%</div>' +
                '<div class="MixerStripActions">' +
                '<button type="button" class="MixerMute' + (Ch.Muted ? ' Active' : '') + '">M</button>' +
                '<button type="button" class="MixerFxBtn">FX</button>' +
                '</div>';
            Strip.addEventListener("click", function () {
                State.SelectedChannelId = Ch.Id;
                RenderChannels();
                RenderMixer();
            });
            var Fader = Strip.querySelector(".MixerFader");
            Fader.addEventListener("input", function () {
                Ch.Gain = Number(Fader.value) / 100;
                Strip.querySelector(".MixerFaderVal").textContent = Fader.value + "%";
                if (State.Simulation.Playing) RescheduleTransport();
            });
            var Knobs = Strip.querySelectorAll(".MixerKnob input");
            var Ki;
            for (Ki = 0; Ki < Knobs.length; Ki++) {
                Knobs[Ki].addEventListener("input", function (Ev) {
                    var El = Ev.currentTarget;
                    EnsureChannelFx(Ch);
                    if (El.getAttribute("data-eq")) {
                        Ch.Fx[El.getAttribute("data-eq")] = Number(El.value);
                    } else if (El.getAttribute("data-fx")) {
                        Ch.Fx[El.getAttribute("data-fx")] = Number(El.value);
                    } else if (El.getAttribute("data-pan")) {
                        Ch.Fx.Pan = Number(El.value) / 100;
                    }
                    if (State.Simulation.Playing) RescheduleTransport();
                });
            }
            Strip.querySelector(".MixerMute").addEventListener("click", function (Ev) {
                Ev.stopPropagation();
                Ch.Muted = !Ch.Muted;
                RenderChannels();
                RenderMixer();
                if (State.Simulation.Playing) RescheduleTransport();
            });
            Strip.querySelector(".MixerFxBtn").addEventListener("click", function (Ev) {
                Ev.stopPropagation();
                OpenChannelFxModal(Ch);
            });
            Host.appendChild(Strip);
        })(Channel, Index);
    }
}

function BindMixerUi() {
    function CloseMixer(Event) {
        if (Event) {
            Event.preventDefault();
            Event.stopPropagation();
        }
        HideModal("MixerModal");
    }
    var OpenBtn = document.querySelector("#OpenMixerBtn");
    var MenuMixer = document.querySelector("#MenuOpenMixer");
    if (OpenBtn) {
        OpenBtn.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            OpenMixer();
        });
    }
    if (MenuMixer) {
        MenuMixer.addEventListener("click", function (Event) {
            Event.preventDefault();
            Event.stopPropagation();
            OpenMixer();
            var All = document.querySelectorAll(".MenuItem.Open");
            var J;
            for (J = 0; J < All.length; J++) All[J].classList.remove("Open");
        });
    }
    var Close = document.querySelector("#MixerClose");
    if (Close) {
        Close.addEventListener("click", function (Event) {
            CloseMixer(Event);
            CloseFloatingWidget("mixer");
        });
    }
    var Overlay = document.querySelector("#MixerModal");
    if (Overlay) {
        Overlay.addEventListener("click", function (Event) {
            if (Event.target === Overlay) CloseMixer(Event);
        });
    }
}

function OpenTimingPlugin() {
    CreateFloatingWidget({
        Id: "timing",
        Title: "Timing",
        Width: 320,
        Height: 260,
        Build: function (Body) {
            Body.innerHTML =
                '<div class="FwPluginRows">' +
                '<button type="button" class="Button" id="FwMetroToggle">Metronome</button>' +
                '<label>Volume <input type="range" id="FwMetroVol" min="0" max="100" value="70"></label>' +
                '<button type="button" class="Button" id="FwCountToggle">Count-In</button>' +
                '<label>Count-In Beats <input type="number" id="FwCountBeats" min="1" max="32" value="4"></label>' +
                '</div>';
            var Metro = Body.querySelector("#FwMetroToggle");
            var Count = Body.querySelector("#FwCountToggle");
            var Vol = Body.querySelector("#FwMetroVol");
            var Beats = Body.querySelector("#FwCountBeats");
            function Sync() {
                if (Metro) Metro.classList.toggle("Active", !!Engine.MetronomeEnabled);
                if (Count) Count.classList.toggle("Active", !!Engine.PreRollEnabled);
                if (Vol) Vol.value = String(Math.round((Engine.MetronomeVolume != null ? Engine.MetronomeVolume : 0.7) * 100));
                if (Beats) Beats.value = String(Engine.PreRollBeats || 4);
            }
            Sync();
            if (Metro) Metro.addEventListener("click", function () {
                Engine.SetMetronomeEnabled(!Engine.MetronomeEnabled);
                Sync();
                if (Engine.MetronomeEnabled && State.Simulation.Playing) {
                    Engine.ScheduleMetronome(Engine.GetSongTime(), State.TotalBeats);
                }
            });
            if (Count) Count.addEventListener("click", function () {
                Engine.PreRollEnabled = !Engine.PreRollEnabled;
                Sync();
            });
            if (Vol) Vol.addEventListener("input", function () {
                Engine.SetMetronomeVolume(Number(Vol.value) / 100);
            });
            if (Beats) {
                function Apply() {
                    var N = Math.max(1, Math.min(32, Number(Beats.value) || 4));
                    Beats.value = String(N);
                    Engine.PreRollBeats = N;
                }
                Beats.addEventListener("change", Apply);
                Beats.addEventListener("blur", Apply);
            }
        }
    });
}

function OpenStudioSettings() {
    var Theme = document.querySelector("#SettingsTheme");
    var Quality = document.querySelector("#SettingsAudioQuality");
    var Beats = document.querySelector("#SettingsTimelineBeats");
    var Follow = document.querySelector("#SettingsFollowPlayhead");
    var Saved = {};
    try { Saved = JSON.parse(localStorage.getItem("OsStudioSettings") || "{}"); } catch (_) {}
    if (Theme) Theme.value = Saved.Theme || document.documentElement.getAttribute("data-theme") || "dark";
    if (Quality) Quality.value = Saved.Quality || "high";
    if (Beats) Beats.value = String(State.TotalBeats || 256);
    if (Follow) Follow.checked = State.FollowPlayhead !== false;
    ShowModal("StudioSettingsModal");
}

function ApplyStudioSettings() {
    var Theme = document.querySelector("#SettingsTheme");
    var Quality = document.querySelector("#SettingsAudioQuality");
    var Beats = document.querySelector("#SettingsTimelineBeats");
    var Follow = document.querySelector("#SettingsFollowPlayhead");
    var ThemeVal = Theme ? Theme.value : "dark";
    var QualityVal = Quality ? Quality.value : "high";
    var BeatsVal = Beats ? Math.max(16, Math.min(2048, Number(Beats.value) || 256)) : State.TotalBeats;
    if (Beats) Beats.value = String(BeatsVal);
    State.TotalBeats = BeatsVal;
    State.FollowPlayhead = Follow ? !!Follow.checked : true;
    document.documentElement.setAttribute("data-theme", ThemeVal);
    document.body.setAttribute("data-theme", ThemeVal);
    Engine.EnsureCtx();
    if (QualityVal === "low") Engine.MaxVoices = 32;
    else if (QualityVal === "medium") Engine.MaxVoices = 96;
    else Engine.MaxVoices = 256;
    try {
        localStorage.setItem("OsStudioSettings", JSON.stringify({
            Theme: ThemeVal,
            Quality: QualityVal,
            TotalBeats: BeatsVal,
            FollowPlayhead: State.FollowPlayhead
        }));
    } catch (_) {}
    ResizeCanvases();
    DrawAll();
}

function OpenMasterEqPlugin() {
    if (!State.MasterEq) State.MasterEq = { Low: 0, Mid: 0, High: 0 };
    CreateFloatingWidget({
        Id: "master-eq",
        Title: "Master EQ",
        Width: 320,
        Height: 240,
        Build: function (Body) {
            Body.innerHTML =
                '<div class="FwPluginRows">' +
                '<label>Low <input type="range" id="FwEqLow" min="-24" max="24" value="' + (State.MasterEq.Low || 0) + '"></label>' +
                '<label>Mid <input type="range" id="FwEqMid" min="-24" max="24" value="' + (State.MasterEq.Mid || 0) + '"></label>' +
                '<label>High <input type="range" id="FwEqHigh" min="-24" max="24" value="' + (State.MasterEq.High || 0) + '"></label>' +
                '</div>';
            function Bind(Id, Key) {
                var El = Body.querySelector("#" + Id);
                if (!El) return;
                El.addEventListener("input", function () {
                    State.MasterEq[Key] = Number(El.value);
                    Engine.EnsureCtx();
                    if (Engine.ApplyMasterEq) Engine.ApplyMasterEq(State.MasterEq);
                });
            }
            Bind("FwEqLow", "Low");
            Bind("FwEqMid", "Mid");
            Bind("FwEqHigh", "High");
        }
    });
}

function OpenAnalyzerPlugin() {
    CreateFloatingWidget({
        Id: "analyzer",
        Title: "Spectrum Analyzer",
        Width: 440,
        Height: 260,
        ContentHtml: '<canvas class="AnalyzerCanvas FwFillCanvas" id="AnalyzerCanvasFw"></canvas>',
        Build: function (Body) {
            function DrawAnalyzer() {
                if (!FloatingWidgets.analyzer || !FloatingWidgets.analyzer.El) {
                    State.AnalyzerRaf = null;
                    return;
                }
                var Canvas = Body.querySelector("canvas");
                if (!Canvas) return;
                var Ctx = Canvas.getContext("2d");
                var Dpr = window.devicePixelRatio || 1;
                var W = Canvas.clientWidth || 400;
                var H = Canvas.clientHeight || 180;
                if (Canvas.width !== Math.floor(W * Dpr) || Canvas.height !== Math.floor(H * Dpr)) {
                    Canvas.width = Math.floor(W * Dpr);
                    Canvas.height = Math.floor(H * Dpr);
                    Ctx.setTransform(Dpr, 0, 0, Dpr, 0, 0);
                }
                Ctx.fillStyle = "#0c0c0e";
                Ctx.fillRect(0, 0, W, H);
                Engine.EnsureCtx();
                var Data = Engine.GetFrequencyData && Engine.GetFrequencyData();
                if (Data && Data.length) {
                    var Bars = 72;
                    var I;
                    for (I = 0; I < Bars; I++) {
                        var Mag = Data[Math.floor(I / Bars * Data.length)] / 255;
                        var Bh = Mag * (H - 10);
                        Ctx.fillStyle = "rgba(255, 106, 0, " + (0.3 + Mag * 0.7) + ")";
                        Ctx.fillRect(I * (W / Bars) + 1, H - Bh - 4, W / Bars - 2, Bh);
                    }
                } else {
                    Ctx.fillStyle = "#555";
                    Ctx.font = "12px Cascadia Mono, monospace";
                    Ctx.fillText("Play audio to see spectrum", 12, H / 2);
                }
                State.AnalyzerRaf = requestAnimationFrame(DrawAnalyzer);
            }
            State.AnalyzerRaf = requestAnimationFrame(DrawAnalyzer);
        },
        OnClose: function () { State.AnalyzerRaf = null; }
    });
}

function BindStudioPlugins() {
    var ClosePairs = [
        ["TimingPluginClose", "TimingPluginModal"],
        ["StudioSettingsClose", "StudioSettingsModal"],
        ["StudioSettingsCancel", "StudioSettingsModal"],
        ["MasterEqPluginClose", "MasterEqPluginModal"],
        ["AnalyzerPluginClose", "AnalyzerPluginModal"]
    ];
    var I;
    for (I = 0; I < ClosePairs.length; I++) {
        (function (BtnId, ModalId) {
            var Btn = document.querySelector("#" + BtnId);
            if (Btn) Btn.addEventListener("click", function (Event) {
                Event.preventDefault();
                Event.stopPropagation();
                HideModal(ModalId);
            });
            var Overlay = document.querySelector("#" + ModalId);
            if (Overlay) {
                Overlay.addEventListener("click", function (Event) {
                    if (Event.target === Overlay) HideModal(ModalId);
                });
            }
        })(ClosePairs[I][0], ClosePairs[I][1]);
    }

    var MetroToggle = document.querySelector("#TimingMetronomeToggle");
    if (MetroToggle) {
        MetroToggle.addEventListener("click", function () {
            Engine.SetMetronomeEnabled(!Engine.MetronomeEnabled);
            MetroToggle.classList.toggle("Active", !!Engine.MetronomeEnabled);
            if (Engine.MetronomeEnabled && State.Simulation.Playing) {
                Engine.ScheduleMetronome(Engine.GetSongTime(), State.TotalBeats);
            }
        });
    }
    var CountToggle = document.querySelector("#TimingCountInToggle");
    if (CountToggle) {
        CountToggle.addEventListener("click", function () {
            Engine.PreRollEnabled = !Engine.PreRollEnabled;
            CountToggle.classList.toggle("Active", !!Engine.PreRollEnabled);
        });
    }
    var Vol = document.querySelector("#TimingMetronomeVolume");
    if (Vol) {
        Vol.addEventListener("input", function () {
            Engine.SetMetronomeVolume(Number(Vol.value) / 100);
        });
    }
    var Beats = document.querySelector("#TimingCountInBeats");
    if (Beats) {
        function ApplyBeats() {
            var N = Math.max(1, Math.min(32, Number(Beats.value) || 4));
            Beats.value = String(N);
            Engine.PreRollBeats = N;
        }
        Beats.addEventListener("change", ApplyBeats);
        Beats.addEventListener("blur", ApplyBeats);
    }

    var ApplySettings = document.querySelector("#StudioSettingsApply");
    if (ApplySettings) {
        ApplySettings.addEventListener("click", function (Event) {
            Event.preventDefault();
            ApplyStudioSettings();
            HideModal("StudioSettingsModal");
        });
    }

    function BindMasterEq(Id, Key) {
        var El = document.querySelector("#" + Id);
        if (!El) return;
        El.addEventListener("input", function () {
            if (!State.MasterEq) State.MasterEq = { Low: 0, Mid: 0, High: 0 };
            State.MasterEq[Key] = Number(El.value);
            Engine.EnsureCtx();
            if (Engine.ApplyMasterEq) Engine.ApplyMasterEq(State.MasterEq);
        });
    }
    BindMasterEq("MasterEqLow", "Low");
    BindMasterEq("MasterEqMid", "Mid");
    BindMasterEq("MasterEqHigh", "High");

    // Restore settings on boot
    try {
        var Saved = JSON.parse(localStorage.getItem("OsStudioSettings") || "{}");
        if (Saved.Theme) {
            document.documentElement.setAttribute("data-theme", Saved.Theme);
            document.body.setAttribute("data-theme", Saved.Theme);
        }
        if (Saved.TotalBeats) State.TotalBeats = Math.max(16, Math.min(2048, Number(Saved.TotalBeats) || 256));
        if (Saved.FollowPlayhead != null) State.FollowPlayhead = !!Saved.FollowPlayhead;
        if (Saved.Quality === "low") Engine.MaxVoices = 32;
        else if (Saved.Quality === "medium") Engine.MaxVoices = 96;
    } catch (_) {}
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


function RenderChannels() {
    if (!ChannelList) return;
    ChannelList.innerHTML = "";
    var Index;
    var Channel;
    var Row;
    var Selected;

    for (Index = 0; Index < State.Channels.length; Index++) {
        Channel = State.Channels[Index];
        EnsureChannelFx(Channel);
        Selected = State.SelectedChannelId === Channel.Id;
        Row = document.createElement("div");
        Row.className = "ChannelRow" + (Selected ? " Selected" : "") + (Channel.Muted ? " Muted" : "");
        Row.setAttribute("data-id", Channel.Id);
        var GainPct = Math.round((Channel.Gain == null ? 1 : Channel.Gain) * 100);
        Row.innerHTML =
            '<div class="ChannelColor" style="background:' + Channel.Color + '"></div>' +
            '<div class="ChannelMain">' +
            '<div class="ChannelInfo">' +
            '<span class="ChannelName">' + EscapeHtml(Channel.Name || "Channel") + (Channel.Muted ? " (muted)" : "") + '</span>' +
            '</div>' +
            '<div class="ChannelVolRow">' +
            '<span class="ChannelVolLabel">Vol</span>' +
            '<input type="range" class="ChannelVol" min="0" max="100" value="' + GainPct + '" title="Channel volume">' +
            '</div>' +
            '<div class="StepGrid"></div>' +
            '</div>';
        BindChannelRow(Row, Channel);
        RenderStepGrid(Row.querySelector(".StepGrid"), Channel);
        ChannelList.appendChild(Row);
    }
}


function BindChannelRow(Row, Channel) {
    Row.addEventListener("mousedown", function (Event) {
        if (Event.target.closest("input")) return;
        if (Event.target.closest(".StepCell")) return;
        if (Event.button !== 0) return;
        State.SelectedChannelId = Channel.Id;
        RenderChannels();
        UpdateWaveformSource();
        StartChannelDrag(Channel, Event);
    });

    Row.addEventListener("contextmenu", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        State.SelectedChannelId = Channel.Id;
        ShowContextMenu(Event.clientX, Event.clientY, [
            {
                Label: Channel.Muted ? "Unmute" : "Mute",
                Action: function () {
                    Channel.Muted = !Channel.Muted;
                    RenderChannels();
                    if (State.Simulation.Playing) RescheduleTransport();
                    RenderMixer();
                }
            },
            {
                Label: Channel.StretchToClip ? "Disable Stretch" : "Stretch to Clip",
                Checked: !!Channel.StretchToClip,
                Action: function () {
                    Channel.StretchToClip = !Channel.StretchToClip;
                    if (State.Simulation.Playing) RescheduleTransport();
                }
            },
            "-",
            {
                Label: "Channel Color",
                Colors: Colors,
                OnColor: function (Color) {
                    Channel.Color = Color;
                    RenderChannels();
                    DrawTimeline();
                    RenderMixer();
                }
            },
            "-",
            {
                Label: "Channel Effects / EQ…",
                Action: function () { OpenChannelFxModal(Channel); }
            },
            {
                Label: "Open Mixer",
                Action: function () { OpenMixer(Channel.Id); }
            },
            {
                Label: "Save as Sample",
                Action: function () { SaveChannelAsSample(Channel); }
            },
            "-",
            {
                Label: "Remove Channel",
                Danger: true,
                Action: function () {
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
                    if (State.Simulation.Playing) RescheduleTransport();
                    RenderMixer();
                }
            }
        ]);
    });

    var NameEl = Row.querySelector(".ChannelName");
    if (NameEl) {
        NameEl.addEventListener("dblclick", function () {
            PlaceClipOnChannel(Channel, Engine.SecondsToBeats(State.Simulation.Time));
        });
    }

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
            '</div>';
        Item.title = "Double-click to open · Right-click for options";
        Item.title = "Double-click to open";
        (function (Doc, Mine) {
            Item.addEventListener("dblclick", function () {
                OpenProjectFromBrowser(Doc);
            });
            Item.addEventListener("contextmenu", function (Event) {
                Event.preventDefault();
                Event.stopPropagation();
                var Items = [
                    { Label: "Open", Action: function () { OpenProjectFromBrowser(Doc); } }
                ];
                if (Mine) {
                    Items.push("-");
                    Items.push({
                        Label: "Rename…",
                        Action: function () {
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
                        }
                    });
                    Items.push({
                        Label: "Delete",
                        Danger: true,
                        Action: function () {
                            ShowConfirmModal(
                                'Delete project "' + (Doc.Name || "Untitled") + '"? This cannot be undone.',
                                function () {
                                    DeleteProject(Doc.Id).then(function () {
                                        if (State.ProjectId === Doc.Id) {
                                            State.ProjectId = null;
                                            UpdatePublishLabel();
                                        }
                                        RefreshBrowser();
                                    }).catch(function (Err) {
                                        ShowNotice(Err.message || "Delete failed");
                                    });
                                }
                            );
                        }
                    });
                }
                ShowContextMenu(Event.clientX, Event.clientY, Items);
            });
        })(Project, IsMine);
        ProjectListEl.appendChild(Item);
    }
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
            '</div>';
        Item.title = "Double-click to add · Right-click for options";
        BindSampleItem(Item, Sample, IsMine);
        SampleList.appendChild(Item);
    }
}


function BindSampleItem(Item, Sample, IsMine) {
    Item.addEventListener("dblclick", function () {
        AddChannel(Sample);
    });

    Item.addEventListener("contextmenu", function (Event) {
        Event.preventDefault();
        Event.stopPropagation();
        var Items = [
            {
                Label: "Preview",
                Action: function () {
                    Engine.LoadSample(Sample.File).then(function (Buffer) {
                        Engine.EnsureCtx();
                        Engine.StopSources();
                        var Source = Engine.Ctx.createBufferSource();
                        Source.buffer = Buffer;
                        Source.connect(Engine.Master);
                        Source.start();
                        Engine.Sources.push(Source);
                        DrawWaveform();
                    }).catch(function (Error) {
                        ShowNotice("Could not preview: " + (Error.message || Error));
                    });
                }
            },
            {
                Label: "Add to Channel Rack",
                Action: function () { AddChannel(Sample); }
            }
        ];
        if (IsMine) {
            Items.push("-");
            Items.push({
                Label: "Rename…",
                Action: function () {
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
                }
            });
            Items.push({
                Label: "Delete",
                Danger: true,
                Action: function () {
                    if (!State.User) {
                        ShowNotice("Sign in to delete samples.");
                        return;
                    }
                    ShowConfirmModal(
                        'Delete sample "' + (Sample.Name || "Untitled") + '"? This cannot be undone.',
                        function () {
                            var Username = State.User.Username || State.User.DisplayName;
                            DeleteSample(Sample.Id, Username).then(function () {
                                RefreshBrowser();
                            }).catch(function (Err) {
                                ShowNotice(Err.message || "Delete failed");
                            });
                        }
                    );
                }
            });
        }
        ShowContextMenu(Event.clientX, Event.clientY, Items);
    });
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
    BindMenuClick("MenuCut", function () { CutSelectedTimelineItems(); });
    BindMenuClick("MenuCopy", function () { CopySelectedTimelineItems(); });
    BindMenuClick("MenuPaste", function () { PasteClipboardItems(); });
    BindMenuClick("MenuDuplicate", function () { DuplicateSelectedTimelineItems(); });
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
    BindMenuClick("MenuOpenMixer", function () { OpenMixer(); });
    BindMenuClick("MenuTogglePiano", function () {
        var Btn = document.querySelector("#TogglePianoDock");
        if (Btn) Btn.click();
    });
    BindMenuClick("MenuOpenMixer", function () { OpenMixer(); });
    BindMenuClick("MenuPluginTiming", function () { OpenTimingPlugin(); });
    BindMenuClick("MenuPluginMasterEq", function () { OpenMasterEqPlugin(); });
    BindMenuClick("MenuPluginAnalyzer", function () { OpenAnalyzerPlugin(); });
    BindMenuClick("MenuPluginMixer", function () { OpenMixer(); });
    BindMenuClick("MenuStudioSettings", function () { OpenStudioSettings(); });

    var NewBtn = document.querySelector("#NewProjectBtn");
    if (NewBtn) NewBtn.addEventListener("click", NewEmptyProject);
}


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

globalThis.Gui = {
    InitBindings: function () {
        TooltipSystem.Bind();
        BindAuthUi();
        BindConfirmModal();
        BindContextMenuChrome();
        BindChannelFxModal();
        BindTransport();
        var Pub = document.querySelector("#PublishBtn");
        if (Pub) Pub.addEventListener("click", PublishProject);
        var SaveAsBtn = document.querySelector("#SaveAsBtn");
        if (SaveAsBtn) SaveAsBtn.addEventListener("click", SaveProjectAs);
        var Mic = document.querySelector("#MicButton");
        if (Mic) Mic.addEventListener("click", ToggleMicRecord);

        BindTimelineEvents();
        BindTimelineWheelScroll();
        BindWaveformSeek();
        BindBrowser();
        BindDocks();
        BindDockCollapse();
        BindMetronomeUi();
        BindPlaybackVolume();
        BindMenuBar();
        BindKeyboard();
        BindOctaveWheel();
        BindEffects();
        BindMixerUi();
        BindStudioPlugins();
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

        if (PlaylistBody) {
            PlaylistBody.addEventListener("scroll", function () {
                if (RulerCanvas && RulerCanvas.parentElement) {
                    RulerCanvas.parentElement.scrollLeft = PlaylistBody.scrollLeft;
                }
                DrawRuler();
            });
        }

        setInterval(function () {
            UpdateWaveformSource();
        }, 1000);

        requestAnimationFrame(Loop);
    }
};

Boot();