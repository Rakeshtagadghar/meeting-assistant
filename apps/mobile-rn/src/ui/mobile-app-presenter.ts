import {
  MOBILE_AUTH_ROUTES,
  MOBILE_REQUIRED_SCREENS,
  type MobileAuthRoute,
  type MobileRequiredScreen,
} from "../mobile-spec";
import type {
  MobileSessionPresenter,
  MobileSessionViewModel,
} from "./mobile-session-presenter";

export interface MobileNavigationItem {
  id: MobileRequiredScreen;
  label: string;
}

export interface MobileQuickAction {
  id: "newNote" | "startMeeting" | "openChat" | "openSettings";
  label: string;
  targetScreen: MobileRequiredScreen;
}

export interface LandingViewState {
  title: string;
  subtitle: string;
  quickActions: MobileQuickAction[];
}

export interface NoteListItem {
  id: string;
  title: string;
  updatedAtMs: number;
  pinned?: boolean;
}

export interface NotesViewState {
  items: NoteListItem[];
  selectedNoteId: string | null;
  searchQuery: string;
}

export type ChatMessageRole = "assistant" | "user" | "system";

export interface ChatMessageItem {
  id: string;
  role: ChatMessageRole;
  text: string;
  createdAtMs: number;
}

export interface ChatViewState {
  threadId: string | null;
  messages: ChatMessageItem[];
  draft: string;
  busy: boolean;
}

export interface SettingsViewState {
  defaultLiveAnalysisEnabled: boolean;
  analyticsEnabled: boolean;
  remindersEnabled: boolean;
}

export interface MobileAuthViewState {
  status: "unknown" | "authenticated" | "unauthenticated";
  route: MobileAuthRoute | null;
  userLabel: string | null;
  redirectAfterAuth: MobileRequiredScreen;
}

export interface MobileAppViewModel {
  activeScreen: MobileRequiredScreen;
  navigation: MobileNavigationItem[];
  landing: LandingViewState;
  notes: NotesViewState;
  meeting: MobileSessionViewModel;
  chat: ChatViewState;
  settings: SettingsViewState;
  auth: MobileAuthViewState;
}

type MobileAppListener = (viewModel: MobileAppViewModel) => void;

export interface MobileAppPresenterOptions {
  sessionPresenter: MobileSessionPresenter;
  initialScreen?: MobileRequiredScreen;
}

export class MobileAppPresenter {
  private readonly sessionPresenter: MobileSessionPresenter;
  private readonly listeners = new Set<MobileAppListener>();
  private readonly unsubscribeSession: () => void;
  private viewModel: MobileAppViewModel;

  constructor(options: MobileAppPresenterOptions) {
    this.sessionPresenter = options.sessionPresenter;
    this.viewModel = createInitialMobileAppViewModel(
      options.initialScreen ?? "landing",
      this.sessionPresenter.getViewModel(),
    );
    this.unsubscribeSession = this.sessionPresenter.subscribe((meetingView) => {
      this.viewModel = {
        ...this.viewModel,
        meeting: meetingView,
      };
      this.emit();
    });
  }

  subscribe(listener: MobileAppListener): () => void {
    this.listeners.add(listener);
    listener(this.viewModel);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getViewModel(): MobileAppViewModel {
    return this.viewModel;
  }

  selectScreen(screen: MobileRequiredScreen): void {
    if (!isRequiredScreen(screen)) return;
    if (isProtectedScreen(screen) && !this.isAuthenticated()) {
      this.startAuthSignIn(screen);
      return;
    }
    if (this.viewModel.activeScreen === screen) return;
    this.viewModel = {
      ...this.viewModel,
      activeScreen: screen,
    };
    this.emit();
  }

  setNotes(items: NoteListItem[]): void {
    this.viewModel = {
      ...this.viewModel,
      notes: {
        ...this.viewModel.notes,
        items: [...items],
      },
    };
    this.emit();
  }

  setSelectedNote(noteId: string | null): void {
    this.viewModel = {
      ...this.viewModel,
      notes: {
        ...this.viewModel.notes,
        selectedNoteId: noteId,
      },
    };
    this.emit();
  }

  setNotesSearchQuery(value: string): void {
    this.viewModel = {
      ...this.viewModel,
      notes: {
        ...this.viewModel.notes,
        searchQuery: value,
      },
    };
    this.emit();
  }

  setChatThread(threadId: string | null): void {
    this.viewModel = {
      ...this.viewModel,
      chat: {
        ...this.viewModel.chat,
        threadId,
      },
    };
    this.emit();
  }

  setChatBusy(busy: boolean): void {
    this.viewModel = {
      ...this.viewModel,
      chat: {
        ...this.viewModel.chat,
        busy,
      },
    };
    this.emit();
  }

  setChatDraft(draft: string): void {
    this.viewModel = {
      ...this.viewModel,
      chat: {
        ...this.viewModel.chat,
        draft,
      },
    };
    this.emit();
  }

  setChatMessages(messages: ChatMessageItem[]): void {
    this.viewModel = {
      ...this.viewModel,
      chat: {
        ...this.viewModel.chat,
        messages: [...messages],
      },
    };
    this.emit();
  }

  appendChatMessage(message: ChatMessageItem): void {
    this.viewModel = {
      ...this.viewModel,
      chat: {
        ...this.viewModel.chat,
        messages: [...this.viewModel.chat.messages, message],
      },
    };
    this.emit();
  }

  updateSettings(next: Partial<SettingsViewState>): void {
    this.viewModel = {
      ...this.viewModel,
      settings: {
        ...this.viewModel.settings,
        ...next,
      },
    };
    this.emit();
  }

  setAuthSession(args: {
    status: MobileAuthViewState["status"];
    userLabel?: string | null;
    route?: MobileAuthRoute | null;
    redirectAfterAuth?: MobileRequiredScreen;
  }): void {
    const nextRoute =
      args.route !== undefined
        ? args.route
        : args.status === "authenticated"
          ? null
          : this.viewModel.auth.route;
    this.viewModel = {
      ...this.viewModel,
      auth: {
        ...this.viewModel.auth,
        status: args.status,
        route: nextRoute,
        userLabel: args.userLabel ?? this.viewModel.auth.userLabel,
        redirectAfterAuth:
          args.redirectAfterAuth ?? this.viewModel.auth.redirectAfterAuth,
      },
    };
    this.emit();
  }

  startAuthSignIn(redirectAfterAuth?: MobileRequiredScreen): void {
    this.viewModel = {
      ...this.viewModel,
      auth: {
        ...this.viewModel.auth,
        status: "unauthenticated",
        route: "auth/sign-in",
        redirectAfterAuth:
          redirectAfterAuth ?? this.viewModel.auth.redirectAfterAuth,
      },
    };
    this.emit();
  }

  openAuthCallback(): void {
    this.viewModel = {
      ...this.viewModel,
      auth: {
        ...this.viewModel.auth,
        route: "auth/callback",
      },
    };
    this.emit();
  }

  completeAuth(args?: { userLabel?: string | null }): void {
    const redirectTarget = this.viewModel.auth.redirectAfterAuth;
    this.viewModel = {
      ...this.viewModel,
      activeScreen: redirectTarget,
      auth: {
        ...this.viewModel.auth,
        status: "authenticated",
        route: null,
        userLabel: args?.userLabel ?? this.viewModel.auth.userLabel,
      },
    };
    this.emit();
  }

  signOut(): void {
    this.viewModel = {
      ...this.viewModel,
      activeScreen: "landing",
      auth: {
        ...this.viewModel.auth,
        status: "unauthenticated",
        route: "auth/sign-in",
        userLabel: null,
        redirectAfterAuth: "notes",
      },
    };
    this.emit();
  }

  async startMeeting(args?: { liveAnalysisEnabled?: boolean }): Promise<void> {
    if (!this.isAuthenticated()) {
      this.startAuthSignIn("meeting");
      return;
    }
    await this.sessionPresenter.start(args);
    this.selectScreen("meeting");
  }

  async pauseMeeting(): Promise<void> {
    await this.sessionPresenter.pause();
  }

  async resumeMeeting(): Promise<void> {
    await this.sessionPresenter.resume();
  }

  async stopMeeting(): Promise<void> {
    await this.sessionPresenter.stop();
  }

  setMeetingLiveAnalysisEnabled(enabled: boolean): void {
    this.sessionPresenter.setLiveAnalysisEnabled(enabled);
  }

  dispose(): void {
    this.unsubscribeSession();
    this.listeners.clear();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.viewModel);
    }
  }

  private isAuthenticated(): boolean {
    return this.viewModel.auth.status === "authenticated";
  }
}

function createInitialMobileAppViewModel(
  initialScreen: MobileRequiredScreen,
  meeting: MobileSessionViewModel,
): MobileAppViewModel {
  return {
    activeScreen: initialScreen,
    navigation: buildNavigationItems(),
    landing: {
      title: "Golden Minutes",
      subtitle: "Capture meetings, chat with notes, and stay in flow.",
      quickActions: [
        { id: "newNote", label: "New Note", targetScreen: "notes" },
        { id: "startMeeting", label: "Start Meeting", targetScreen: "meeting" },
        { id: "openChat", label: "Open Chat", targetScreen: "chat" },
        {
          id: "openSettings",
          label: "Settings",
          targetScreen: "settings",
        },
      ],
    },
    notes: {
      items: [],
      selectedNoteId: null,
      searchQuery: "",
    },
    meeting,
    chat: {
      threadId: null,
      messages: [],
      draft: "",
      busy: false,
    },
    settings: {
      defaultLiveAnalysisEnabled: false,
      analyticsEnabled: false,
      remindersEnabled: true,
    },
    auth: {
      status: "unknown",
      route: null,
      userLabel: null,
      redirectAfterAuth: "notes",
    },
  };
}

function buildNavigationItems(): MobileNavigationItem[] {
  const labels: Record<MobileRequiredScreen, string> = {
    landing: "Landing",
    notes: "Notes",
    meeting: "Meeting",
    chat: "Chat",
    settings: "Settings",
  };
  return MOBILE_REQUIRED_SCREENS.map((screen) => ({
    id: screen,
    label: labels[screen],
  }));
}

function isRequiredScreen(value: string): value is MobileRequiredScreen {
  return (MOBILE_REQUIRED_SCREENS as readonly string[]).includes(value);
}

function isProtectedScreen(screen: MobileRequiredScreen): boolean {
  return screen !== "landing";
}

export function isProtectedMobileScreen(screen: MobileRequiredScreen): boolean {
  return isProtectedScreen(screen);
}

export function isAuthRoute(value: string): value is MobileAuthRoute {
  return (MOBILE_AUTH_ROUTES as readonly string[]).includes(value);
}
