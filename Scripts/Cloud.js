const FirebaseConfig = {
    apiKey: "AIzaSyB6izOBCEtkRTWIkJyg2fs-AUFWiBS8qSs",
    authDomain: "openstudio-ca705.firebaseapp.com",
    projectId: "openstudio-ca705",
    storageBucket: "openstudio-ca705.firebasestorage.app",
    messagingSenderId: "923358660017",
    appId: "1:923358660017:web:f355aa7c4f8cc54e836990",
    measurementId: "G-9MMGVHPY7E"
};

const GithubStorageConfig = {
    Token: "",
    StorageOwner: "kayyraa",
    StorageName: "DirectStorage"
};

const App = firebase.initializeApp(FirebaseConfig);
const Database = firebase.firestore();

Database.enablePersistence({ synchronizeTabs: true }).catch((Error) => {
    if (Error?.code === "failed-precondition") {
        console.warn("[Firestore] Persistence disabled: multiple tabs open.");
    } else if (Error?.code === "unimplemented") {
        console.warn("[Firestore] Persistence not supported in this browser.");
    }
});

try {
    firebase.analytics();
} catch (_) {}

globalThis.Guid = () => {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (Char) => {
        const Random = (Math.random() * 16) | 0;
        return (Char === "x" ? Random : (Random & 0x3) | 0x8).toString(16);
    });
};

globalThis.Firestore = class {
    constructor(Collection, Options = {}) {
        this.CollectionName = Collection;
        this.Collection = Database.collection(Collection);
        this.CacheTtlMs = Options.CacheTtlMs ?? 30000;
        this.MaxRetries = Options.MaxRetries ?? 3;
        this.Cache = new Map();
        this.Inflight = new Map();

        if (Options.Realtime) {
            this.UnsubscribeAll = this.Collection.onSnapshot(
                (Snapshot) => this.SetCache("All", Snapshot),
                (Error) => console.error(`[Firestore:${Collection}] Realtime listener error`, Error)
            );
        }
    }

    Now = () => Date.now();

    SetCache(Key, Value) {
        this.Cache.set(Key, {
            Value,
            ExpiresAt: this.Now() + this.CacheTtlMs
        });
    }

    GetCache(Key) {
        const Entry = this.Cache.get(Key);

        if (!Entry) return undefined;

        if (this.Now() > Entry.ExpiresAt) {
            this.Cache.delete(Key);
            return undefined;
        }

        return Entry.Value;
    }

    InvalidateCache(Key) {
        if (Key) {
            this.Cache.delete(Key);
        } else {
            this.Cache.clear();
        }
    }

    QueryKey(Field, Op, Value) {
        return `Q:${Field}:${Op}:${JSON.stringify(Value)}`;
    }

    async WithRetry(Fn, Label) {
        let Attempt = 0;
        let LastError;

        while (Attempt < this.MaxRetries) {
            try {
                return await Fn();
            } catch (Error) {
                LastError = Error;

                if (Error?.code === "permission-denied" || Error?.code === "not-found") {
                    throw Error;
                }

                Attempt++;

                if (Attempt >= this.MaxRetries) break;

                const Backoff = Math.min(1000 * 2 ** Attempt, 8000) + Math.random() * 200;

                console.warn(
                    `[Firestore:${this.CollectionName}] ${Label} failed (attempt ${Attempt}/${this.MaxRetries}), retrying in ${Math.round(Backoff)}ms`,
                    Error
                );

                await new Promise((Resolve) => setTimeout(Resolve, Backoff));
            }
        }

        throw LastError;
    }

    async Dedupe(Key, Fn) {
        if (this.Inflight.has(Key)) {
            return this.Inflight.get(Key);
        }

        const Promise = Fn().finally(() => this.Inflight.delete(Key));
        this.Inflight.set(Key, Promise);

        return Promise;
    }

    async NewDocument(Object, Id) {
        if (Object == null || typeof Object !== "object") {
            throw new TypeError("NewDocument: Object must be a non-null object");
        }

        const DocId = Id ?? Guid();
        const Payload = { ...Object };

        const Result = await this.WithRetry(
            () => this.Collection.doc(DocId).set(Payload),
            "NewDocument"
        );

        this.InvalidateCache();

        return { Id: DocId, Result };
    }

    async UpdateDocument(Id, Object) {
        if (!Id) throw new TypeError("UpdateDocument: Id is required");

        const Payload = { ...Object };

        const Result = await this.WithRetry(
            () => this.Collection.doc(Id).update(Payload),
            "UpdateDocument"
        );

        this.InvalidateCache();

        return Result;
    }

    async DeleteDocument(Id) {
        if (!Id) throw new TypeError("DeleteDocument: Id is required");

        const Result = await this.WithRetry(
            () => this.Collection.doc(Id).delete(),
            "DeleteDocument"
        );

        this.InvalidateCache();

        return Result;
    }

    async GetDocumentById(Id, ForceFresh = false) {
        if (!Id) throw new TypeError("GetDocumentById: Id is required");

        const Key = `Id:${Id}`;

        if (!ForceFresh) {
            const Cached = this.GetCache(Key);
            if (Cached !== undefined) return Cached;
        }

        return this.Dedupe(Key, async () => {
            const Doc = await this.WithRetry(
                () => this.Collection.doc(Id).get(),
                "GetDocumentById"
            );

            this.SetCache(Key, Doc);
            return Doc;
        });
    }

    async GetDocuments(ForceFresh = false) {
        const Key = "All";

        if (!ForceFresh) {
            const Cached = this.GetCache(Key);
            if (Cached !== undefined) return Cached;
        }

        return this.Dedupe(Key, async () => {
            const Snapshot = await this.WithRetry(
                () => this.Collection.get(),
                "GetDocuments"
            );

            this.SetCache(Key, Snapshot);
            return Snapshot;
        });
    }

    async GetDocumentsByField(Field, Value, ForceFresh = false) {
        const Key = this.QueryKey(Field, "==", Value);

        if (!ForceFresh) {
            const Cached = this.GetCache(Key);
            if (Cached !== undefined) return Cached;
        }

        return this.Dedupe(Key, async () => {
            const Snapshot = await this.WithRetry(
                () => this.Collection.where(Field, "==", Value).get(),
                "GetDocumentsByField"
            );

            this.SetCache(Key, Snapshot);
            return Snapshot;
        });
    }

    ClearCache() {
        this.InvalidateCache();
    }

    Dispose() {
        this.UnsubscribeAll?.();
        this.Cache.clear();
        this.Inflight.clear();
    }

};


globalThis.AccountsDb = new Firestore("Accounts");
globalThis.SamplesDb = new Firestore("Samples", { Realtime: true });
globalThis.ProjectsDb = new Firestore("Projects");


globalThis.DocData = (Doc) => {
    if (!Doc?.exists) return null;

    const Data = Doc.data() || {};

    const Nested = Data.Table && typeof Data.Table === "object" ? Data.Table : {};
    const Merged = { ...Nested, ...Data };
    delete Merged.Table;

    return { Id: Doc.id, ...Merged };
};


globalThis.SignIn = async (Username, Password) => {
    const Snapshot = await AccountsDb.GetDocumentsByField("Username", Username, true);

    if (Snapshot.empty) {
        const All = await AccountsDb.GetDocuments(true);

        for (const Doc of All.docs) {
            const Data = DocData(Doc);

            if (Data?.Username === Username && String(Data.Password) === String(Password)) {
                return Data;
            }
        }

        throw new Error("Invalid username or password");
    }

    const Data = DocData(Snapshot.docs[0]);

    if (String(Data.Password) !== String(Password)) {
        throw new Error("Invalid username or password");
    }

    return Data;
};


globalThis.RegisterAccount = async ({ Username, Password, DisplayName, Image }) => {
    const Existing = await AccountsDb.GetDocumentsByField("Username", Username, true);

    if (!Existing.empty) {
        throw new Error("Username already taken");
    }

    const Payload = {
        Username,
        Password: String(Password),
        DisplayName: DisplayName || Username,
        Image: Image || ""
    };

    const { Id } = await AccountsDb.NewDocument(Payload);

    return { Id, ...Payload };
};


globalThis.ListSamples = async () => {
    const Snapshot = await SamplesDb.GetDocuments(true);
    return Snapshot.docs.map(DocData).filter(Boolean);
};


globalThis.UploadSample = async (File, Meta = {}) => {
    const Author = Meta.Author || "anonymous";
    const Genre = Meta.Genre || "Uncategorized";
    const Name = Meta.Name || File.name.replace(/\.[^.]+$/, "");
    const SafeName = File.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const Path = `OpenStudio/${Guid().slice(0, 8)}-${SafeName}`;

    const Buffer = await File.arrayBuffer();
    const Bytes = new Uint8Array(Buffer);
    let Binary = "";

    for (let Index = 0; Index < Bytes.length; Index++) {
        Binary += String.fromCharCode(Bytes[Index]);
    }

    const Content = btoa(Binary);

    const ApiUrl = `https://api.github.com/repos/${GithubStorageConfig.StorageOwner}/${GithubStorageConfig.StorageName}/contents/${Path}`;

    const PutResponse = await fetch(ApiUrl, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${GithubStorageConfig.Token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: `Upload sample: ${Name}`,
            content: Content
        })
    });

    if (!PutResponse.ok) {
        const ErrorBody = await PutResponse.text();
        throw new Error(`GitHub upload failed (${PutResponse.status}): ${ErrorBody}`);
    }

    const PutData = await PutResponse.json();

    const RawUrl = `https://github.com/${GithubStorageConfig.StorageOwner}/${GithubStorageConfig.StorageName}/blob/main/${Path}?raw=true`;

    const SampleDoc = {
        Author,
        File: RawUrl,
        Genre,
        Name,
        Timestamp: Math.floor(Date.now() / 1000)
    };

    const { Id } = await SamplesDb.NewDocument(SampleDoc);

    return {
        Id,
        ...SampleDoc,
        DownloadUrl: PutData.content?.download_url || RawUrl
    };
};


globalThis.SaveProject = async (Project, Options = {}) => {
    if (!Project || typeof Project !== "object") {
        throw new TypeError("SaveProject: Project object required");
    }

    const CurrentUser = Options.CurrentUser || Project.Author || "anonymous";

    const Payload = {
        Author: Project.Author || CurrentUser,
        Name: Project.Name || "Untitled Project",
        Channels: Project.Channels || [],
        Tempo: Project.Tempo || 120,
        Timestamp: Project.Timestamp || Date.now()
    };

    if (Project.Id) {
        const Existing = await LoadProjectDoc(Project.Id);
        if (!Existing) {
            throw new Error("Project not found");
        }
        if (String(Existing.Author || "") !== String(CurrentUser)) {
            throw new Error("Only the author can overwrite this project. Use Save As (clear id) or open your own project.");
        }
        Payload.Author = Existing.Author;
        await ProjectsDb.UpdateDocument(Project.Id, Payload);
        return { Id: Project.Id, ...Payload };
    }

    const { Id } = await ProjectsDb.NewDocument(Payload);
    return { Id, ...Payload };
};

globalThis.DeleteProject = async (Id) => {
    return await ProjectsDb.DeleteDocument(Id);
};

globalThis.ListProjects = async (Author) => {
    if (Author) {
        const Snapshot = await ProjectsDb.GetDocumentsByField("Author", Author, true);
        return Snapshot.docs.map(DocData).filter(Boolean);
    }
    const Snapshot = await ProjectsDb.GetDocuments(true);
    return Snapshot.docs.map(DocData).filter(Boolean);
};

globalThis.LoadProjectDoc = async (Id) => {
    const Doc = await ProjectsDb.GetDocumentById(Id, true);
    return DocData(Doc);
};

const SecretsDb = new Firestore("Secrets");

(async () => {
    try {
        const Doc = await SecretsDb.GetDocumentById("Github", true);
        const Data = DocData(Doc);
        if (Data?.Value) GithubStorageConfig.Token = Data.Value;
    } catch (Error) {
        alert("Failed to load GitHub, Please refresh and try again: " + Error.message);
        console.error("Failed to load GitHub token:", Error);
    }
})();