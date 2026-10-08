"use client";

import { useEffect, useRef, useState } from "react";
import {
  PLAYABLE,
  hasGenders,
  styleOf,
  withGender,
  type Gender,
} from "../characters/roster";
import { useDirectory } from "../people/directory";
import { DISTRICTS, districtOfLocation, homeDistrict } from "../districts/registry";
import { getDistrict } from "../districts/active";

/** Spots in the district this person will appear in (visitors use Koramangala until theirs is built). */
const spotsFor = (location: string) => getDistrict(homeDistrict(location)).spots;
const districtInfoTitle = (location: string) => {
  const d = districtOfLocation(location);
  return d.built ? d.title : "KORAMANGALA";
};
import {
  ANSWER_MAX,
  LINK_WHY_MAX,
  STEP_TITLE,
  sendMagicLink,
  stepsFor,
  submitProfile,
  useOnboarding,
  validateKey,
  type Draft,
  type StepKey,
} from "../onboarding";
import {
  CODE_ERRORS,
  CODE_PREFIX,
  GATE_MOCK,
  MOCK_CODES,
  useAccess,
  type Path,
} from "../access";
import { requestLook } from "../player/input";
import { useGame } from "../store";
import { isTouch } from "../device";

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  max,
  autoFocus,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
  autoFocus?: boolean;
}) {
  return (
    <label className="cr-field">
      <span className="cr-label">
        {label} {hint && <em>{hint}</em>}
      </span>
      <input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** A longer answer: cream slab like the other fields, body type so a paragraph stays readable. */
function Answer({
  label,
  value,
  onChange,
  placeholder,
  max,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
  rows?: number;
}) {
  const left = max - value.length;
  return (
    <label className="cr-field">
      <span className="cr-label">
        {label} <em className={left < 40 ? "cr-count cr-count--low" : "cr-count"}>{left}</em>
      </span>
      <textarea
        className="cr-answer"
        value={value}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        enterKeyHint="next"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** The four application questions (CLAUDE.md 5E). One per screen, pay path only. */
const QUESTIONS = {
  why: {
    lede: "Why do you want to be in this city of designers and builders?",
    placeholder: "I’ve been designing in Bengaluru for six years and…",
  },
  want: {
    lede: "Collaborators, a job, a co-founder, feedback, friends — what are you hoping to find here?",
    placeholder: "Someone to pair with on a side project, and…",
  },
  bring: {
    lede: "Your work, talks, mentoring, hiring, events — what do you give back to the people here?",
    placeholder: "I run a monthly crit night in HSR and…",
  },
} as const;

function QuestionStep({
  k,
  d,
  patch,
}: {
  k: "why" | "want" | "bring";
  d: Draft;
  patch: (p: Partial<Draft>) => void;
}) {
  const field = k === "why" ? "appWhy" : k === "want" ? "appWant" : "appBring";
  const q = QUESTIONS[k];
  return (
    <div className="cr-fields">
      <p className="cr-copy cr-q-lede">{q.lede}</p>
      <Answer
        label="YOUR ANSWER"
        value={d[field]}
        onChange={(v) => patch({ [field]: v } as Partial<Draft>)}
        placeholder={q.placeholder}
        max={ANSWER_MAX}
      />
      <span className="cr-q-private">ONLY THE REVIEWERS SEE THIS · NEVER SHOWN IN THE CITY</span>
    </div>
  );
}

function ShowStep({ d, patch }: { d: Draft; patch: (p: Partial<Draft>) => void }) {
  return (
    <div className="cr-fields">
      <p className="cr-copy cr-q-lede">One thing you made that you’re proud of. A shipped product, a case study, a repo, a talk.</p>
      <Field
        label="LINK"
        value={d.appLink}
        onChange={(appLink) => patch({ appLink })}
        placeholder="yourname.design/the-thing"
        max={200}
      />
      <Answer
        label="WHY THIS ONE?"
        value={d.appLinkWhy}
        onChange={(appLinkWhy) => patch({ appLinkWhy })}
        placeholder="It’s the first thing I shipped end to end…"
        max={LINK_WHY_MAX}
        rows={2}
      />
      <span className="cr-q-private">ONLY THE REVIEWERS SEE THIS · NEVER SHOWN IN THE CITY</span>
    </div>
  );
}

function LookStep({
  d,
  patch,
}: {
  d: Draft;
  patch: (p: Partial<Draft>) => void;
}) {
  const style = styleOf(d.character);
  const both = hasGenders(style);
  const setGender = (g: Gender) =>
    patch({ gender: g, character: withGender(d.character, g) });
  return (
    <>
      <div className="cr-gender">
        {(["m", "f"] as const).map((g) => (
          <button
            key={g}
            className={`chip slant${both && d.gender === g ? " chip--on" : ""}`}
            onClick={() => setGender(g)}
            disabled={!both}
            aria-pressed={both && d.gender === g}
          >
            <span className="unslant chip-name">
              {g === "m" ? "MALE" : "FEMALE"}
            </span>
          </button>
        ))}
        {!both && (
          <span className="cr-gender-note">
            This look is the same for everyone
          </span>
        )}
      </div>
      <div className="cr-chips">
        {PLAYABLE.map((c) => (
          <button
            key={c.id}
            className={`chip slant${c.id === style ? " chip--on" : ""}`}
            onClick={() => patch({ character: withGender(c.id, d.gender) })}
            aria-label={c.name}
          >
            <span className="chip-swatch" style={{ background: c.accent }} />
            <span className="unslant chip-name">
              {c.name.replace("THE ", "")}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function GoLiveStep({ d }: { d: Draft }) {
  const userId = useDirectory((s) => s.userId);
  const email = useDirectory((s) => s.email);
  const me = useDirectory((s) => s.me);
  const mail = useOnboarding((s) => s.mail);
  const saving = useOnboarding((s) => s.saving);
  const [addr, setAddr] = useState("");
  const enter = useGame((s) => s.endCreate);
  const showToast = useGame((s) => s.showToast);

  const goLive = async () => {
    const r = await submitProfile();
    if (!r.ok) return;
    enter();
    showToast(
      me?.status === "approved"
        ? "PROFILE UPDATED"
        : "YOU’RE VISIBLE · LIVE FOR EVERYONE ONCE APPROVED",
      "good",
    );
  };

  return (
    <div className="cr-live">
      <div className="cr-summary">
        <span className="cr-summary-k">YOU’LL HANG OUT AT</span>
        <span className="cr-summary-v">{(spotsFor(d.location)[d.spot] ?? Object.values(spotsFor(d.location))[0]).label}</span>
        <span className="cr-summary-k">FROM</span>
        <span className="cr-summary-v">{d.location}, Bengaluru</span>
      </div>

      {userId ? (
        <>
          <p className="cr-copy">
            Signed in as <b>{email}</b>.{" "}
            {me?.status === "approved"
              ? "Your changes go live right away."
              : "You’ll see yourself straight away; everyone else sees you once your profile is approved."}
          </p>
          <button
            autoFocus
            className="btn-primary slant cr-golive"
            onClick={goLive}
            disabled={saving}
          >
            <span className="unslant">
              {saving ? "SAVING…" : me ? "SAVE CHANGES ▸" : "GO LIVE ▸"}
            </span>
          </button>
        </>
      ) : mail === "sent" ? (
        <div className="cr-sent">
          <b>CHECK YOUR INBOX</b>
          <p>
            We sent a sign-in link to <b>{addr}</b>. Tap it on this device and
            you’ll land back here — visible.
          </p>
        </div>
      ) : (
        <>
          <p className="cr-copy">
            Save your profile with a one-tap email link. No passwords.
          </p>
          <div className="cr-email">
            <input
              type="email"
              value={addr}
              placeholder="you@studio.com"
              autoFocus
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMagicLink(addr)}
              aria-label="Email"
            />
            <button
              className="btn-primary slant"
              onClick={() => sendMagicLink(addr)}
              disabled={mail === "sending"}
            >
              <span className="unslant">
                {mail === "sending" ? "SENDING…" : "SEND MY LINK ▸"}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The application summary shared by the last step of both paths. */
function Summary({ d }: { d: Draft }) {
  return (
    <div className="cr-summary">
      <span className="cr-summary-k">YOU’LL HANG OUT AT</span>
      <span className="cr-summary-v">{(spotsFor(d.location)[d.spot] ?? Object.values(spotsFor(d.location))[0]).label}</span>
      <span className="cr-summary-k">FROM</span>
      <span className="cr-summary-v">{d.location}, Bengaluru</span>
      {d.email && (
        <>
          <span className="cr-summary-k">EMAIL</span>
          <span className="cr-summary-v cr-summary-v--plain">{d.email}</span>
        </>
      )}
    </div>
  );
}

const OPTIONS: { path: Path; n: string; title: string; badge: string; blurb: string; open: boolean }[] = [
  { path: "invite", n: "01", title: "I HAVE AN INVITE CODE", badge: "INSTANT", blurb: "A member vouched for you. You go live as soon as you’re done — no review.", open: true },
  { path: "pay", n: "02", title: "APPLY TO JOIN", badge: "REVIEWED", blurb: "Build your profile, pay the application fee, and we review it. Not approved? Full refund.", open: true },
];

/** Step 0 — the gate. Nothing to fill in until you know you can get in. */
function GateScreen({ sel, setSel }: { sel: number; setSel: (n: number) => void }) {
  const choose = useAccess((s) => s.choose);
  const setStep = useOnboarding((s) => s.setStep);
  const pick = (path: Path) => {
    setStep(0);
    choose(path);
  };
  return (
    <>
      <h2 className="cr-title">HOW ARE YOU GETTING IN?</h2>
      <p className="cr-copy gate-lede">
        Anyone can walk the city. To be <b>seen</b>, a member vouches for you — or you apply.
      </p>
      <div className="gate-opts">
        {OPTIONS.map((o, i) => (
          <button
            key={o.path}
            className={`gate-opt slant${sel === i && o.open ? " gate-opt--on" : ""}${o.open ? "" : " gate-opt--off"}`}
            disabled={!o.open}
            onMouseEnter={() => o.open && setSel(i)}
            onFocus={() => o.open && setSel(i)}
            onClick={() => o.open && pick(o.path)}
          >
            <span className="unslant gate-opt-body">
              <span className="gate-opt-n">{o.n}</span>
              <span className="gate-opt-main">
                <span className="gate-opt-title">
                  {o.title} <span className={`gate-badge gate-badge--${o.open ? o.path : "soon"}`}>{o.badge}</span>
                </span>
                <span className="gate-opt-blurb">{o.blurb}</span>
              </span>
              <span className="gate-opt-go">▸</span>
            </span>
          </button>
        ))}
      </div>
      <p className="cr-copy gate-aside gate-signin">
        Already in the city, or already applied?{" "}
        <button className="gate-switch" onClick={() => useAccess.getState().setStage("signin")}>
          SIGN IN ▸
        </button>
      </p>
    </>
  );
}

const SIGNIN_ERRORS: Partial<Record<string, string>> = {
  bad: "That email doesn’t look right.",
  unknown: "No account with that email yet. Use an invite code or apply to join.",
  error: "Couldn’t send the link right now. Check your connection and try again.",
};

/** Returning members and applicants: email in, one-tap link out. Never creates an account. */
function SigninScreen({ email, setEmail }: { email: string; setEmail: (e: string) => void }) {
  const state = useAccess((s) => s.signin);
  const err = SIGNIN_ERRORS[state];
  return (
    <>
      <h2 className="cr-title">WELCOME BACK</h2>
      <p className="cr-copy gate-lede">
        Members and applicants: we’ll email you a one-tap sign-in link. No passwords.
      </p>
      {state === "sent" ? (
        <div className="cr-sent gate-ok">
          <b>✓ CHECK YOUR INBOX</b>
          <p>
            We sent a link to <b>{email.trim()}</b>. Open it on this device and you’re back — profile, application
            and all.
          </p>
        </div>
      ) : (
        <div className="cr-fields">
          <label className="cr-field">
            <span className="cr-label">EMAIL</span>
            <input
              type="email"
              inputMode="email"
              value={email}
              placeholder="you@studio.com"
              autoComplete="email"
              spellCheck={false}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state !== "idle" && state !== "sending") useAccess.setState({ signin: "idle" });
              }}
            />
          </label>
        </div>
      )}
      {err && (
        <div className="cr-error gate-err">
          {err}
          {state === "unknown" && (
            <button className="gate-switch" onClick={() => useAccess.getState().setStage("gate")}>
              WAYS IN ▸
            </button>
          )}
        </div>
      )}
      {GATE_MOCK && <p className="gate-preview">PREVIEW · nothing is sent</p>}
    </>
  );
}

/** Invite path: enter + validate the code. */
function CodeScreen() {
  const code = useAccess((s) => s.code);
  const state = useAccess((s) => s.codeState);
  const inviter = useAccess((s) => s.inviter);
  const setCode = useAccess((s) => s.setCode);
  const check = useAccess((s) => s.checkCode);
  const choose = useAccess((s) => s.choose);
  const setStep = useOnboarding((s) => s.setStep);
  const err = CODE_ERRORS[state];
  return (
    <>
      <h2 className="cr-title">ENTER YOUR CODE</h2>
      <p className="cr-copy gate-lede">Codes come from members. Each one works once.</p>
      <div className={`gate-code${state === "ok" ? " gate-code--ok" : err ? " gate-code--bad" : ""}`}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onFocus={(e) => e.target.select()} // retyping a code replaces it
          onKeyDown={(e) => {
            if (e.key === "Backspace" && code === CODE_PREFIX) e.preventDefault();
          }}
          spellCheck={false}
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Invite code"
        />
        <button className="btn-primary slant gate-check" onClick={() => check()} disabled={state === "checking"}>
          <span className="unslant">{state === "checking" ? "CHECKING…" : "CHECK ▸"}</span>
        </button>
      </div>

      {state === "ok" && inviter && (
        <div className="cr-sent gate-ok">
          <b>✓ INVITED BY {inviter.name.toUpperCase()}</b>
          <p>{inviter.role} vouched for you. Finish your profile and you go live straight away.</p>
        </div>
      )}
      {err && (
        <div className="cr-error gate-err">
          {err}
          <button
            className="gate-switch"
            onClick={() => {
              setStep(0);
              choose("pay");
            }}
          >
            APPLY INSTEAD ▸
          </button>
        </div>
      )}
      {GATE_MOCK && (
        <p className="gate-preview">
          PREVIEW CODES · {Object.keys(MOCK_CODES).join(" · ")}
        </p>
      )}
    </>
  );
}

/** Pay path, last step: save the application, then the Dodo checkout (5E-B). */
function PayStep({ d }: { d: Draft }) {
  const signedIn = useDirectory((s) => !!s.userId);
  const fee = useAccess((s) => s.fee);
  const payError = useAccess((s) => s.payError);
  return (
    <div className="cr-live">
      <Summary d={d} />
      <div className="gate-pay slant">
        <span className="unslant gate-pay-body">
          <span className="gate-pay-k">APPLICATION FEE</span>
          <span className="gate-pay-v">{fee}</span>
          <span className="gate-pay-note">
            {GATE_MOCK ? "PREVIEW · nothing is charged" : "ONE-TIME · FULL REFUND IF NOT APPROVED · SECURE CHECKOUT BY DODO PAYMENTS"}
          </span>
        </span>
      </div>
      {payError && <div className="cr-error">{payError}</div>}
      <ol className="gate-next">
        {!GATE_MOCK && !signedIn && (
          <li><b>CONFIRM YOUR EMAIL</b> — we send {d.email || "you"} a one-tap link. Open it and you go straight to payment.</li>
        )}
        <li><b>PAY {fee}</b> on the secure checkout, then you’re back in the city.</li>
        <li><b>WE REVIEW</b> your profile and your four answers. You stay a ghost meanwhile.</li>
        <li><b>APPROVED</b> — you go live in the city, with 2 invite codes of your own.</li>
        <li><b>NOT APPROVED</b> — your fee is refunded automatically.</li>
      </ol>
    </div>
  );
}

/** Invite path, last step. */
function InviteGoLive({ d }: { d: Draft }) {
  const inviter = useAccess((s) => s.inviter);
  const signedIn = useDirectory((s) => !!s.userId);
  return (
    <div className="cr-live">
      <Summary d={d} />
      <p className="cr-copy">
        <b>{inviter?.name ?? "A member"}</b> vouched for you, so there’s no review.{" "}
        {signedIn ? (
          <>Go live and everyone in the city can see you straight away.</>
        ) : (
          <>
            Go live and we’ll email <b>{d.email}</b> a one-tap sign-in link — open it and you’re on the map.
          </>
        )}
      </p>
    </div>
  );
}

const RESULT: Record<string, { tag: string; title: string; chip: string; tone: "open" | "wait" | "bad" }> = {
  inbox: { tag: "INVITED", title: "CHECK YOUR INBOX", chip: "NO REVIEW NEEDED", tone: "open" },
  confirm: { tag: "APPLICATION", title: "CHECK YOUR INBOX", chip: "CONFIRM YOUR EMAIL", tone: "wait" },
  saved: { tag: "APPLICATION", title: "ONE STEP LEFT", chip: "PAYMENT PENDING", tone: "wait" },
  review: { tag: "APPLICATION", title: "YOU’RE IN THE QUEUE", chip: "UNDER REVIEW", tone: "wait" },
  rejected: { tag: "APPLICATION", title: "NOT THIS TIME", chip: "FEE REFUNDED", tone: "bad" },
  approved: { tag: "APPLICATION", title: "YOU’RE IN", chip: "APPROVED", tone: "open" },
};

/** After the steps (or when reopening with an application in flight). */
function ResultScreen({ onDone }: { onDone: () => void }) {
  const result = useAccess((s) => s.result) ?? "review";
  const choose = useAccess((s) => s.choose);
  const email = useOnboarding((s) => s.draft.email);
  const setStep = useOnboarding((s) => s.setStep);
  const fee = useAccess((s) => s.fee);
  const paying = useAccess((s) => s.paying);
  const payError = useAccess((s) => s.payError);
  const reason = useAccess((s) => s.reason);
  const pay = useAccess((s) => s.pay);
  const r = RESULT[result];
  const useCode = () => {
    setStep(0);
    choose("invite");
  };
  return (
    <>
      <span className={`gate-chip gate-chip--${r.tone}`}>
        <span className="np-dot" /> {r.chip}
      </span>
      <h2 className="cr-title">{r.title}</h2>
      {result === "inbox" && (
        <p className="cr-copy gate-lede">
          We sent a sign-in link to <b>{email}</b>. Open it on this device and you’re live.
        </p>
      )}
      {result === "confirm" && (
        <p className="cr-copy gate-lede">
          We sent a link to <b>{email}</b>. Open it on this device to confirm it’s you — your application is saved
          the moment you’re back.
        </p>
      )}
      {result === "saved" && (
        <>
          <p className="cr-copy gate-lede">
            Your profile and answers are saved. Pay the <b>{fee}</b> application fee and they go to a reviewer.
            Not approved? You get it all back.
          </p>
          {payError && <div className="cr-error">{payError}</div>}
          <p className="cr-copy gate-aside">Got an invite code meanwhile? Use it and you’re in straight away.</p>
        </>
      )}
      {result === "review" && (
        <>
          <p className="cr-copy gate-lede">
            A reviewer looks at every profile. We’ll email <b>{email || "you"}</b> with the decision. Until then
            you’re still a ghost — explore all you like.
          </p>
          <p className="cr-copy gate-aside">Got an invite code meanwhile? Use it and your fee is refunded.</p>
        </>
      )}
      {result === "rejected" && (
        <>
          <p className="cr-copy gate-lede">
            Your application wasn’t approved, and your fee has been refunded in full. You can still walk the city.
          </p>
          <div className="gate-note">
            <span className="cr-summary-k">REVIEWER’S NOTE</span>
            <p>{reason ?? (GATE_MOCK ? "The reviewer’s reason appears here." : "No note was left.")}</p>
          </div>
          <p className="cr-copy gate-aside">A member can still invite you in.</p>
        </>
      )}
      {result === "approved" && (
        <>
          <p className="cr-copy gate-lede">
            Welcome to the city. Open the sign-in link we emailed you and your avatar goes live.
          </p>
          <p className="cr-copy gate-aside">You also get <b>2 invite codes</b> — share them with people you’d vouch for.</p>
        </>
      )}
      {GATE_MOCK && <p className="gate-preview">PREVIEW · nothing was sent or charged</p>}
      <div className="cr-nav">
        {result === "saved" || result === "review" || result === "rejected" ? (
          <button className="pp-btn slant cr-back" onClick={useCode}>
            <span className="unslant">I HAVE A CODE</span>
          </button>
        ) : (
          <span />
        )}
        {result === "saved" ? (
          <button className="btn-primary slant cr-next" autoFocus onClick={() => pay()} disabled={paying}>
            <span className="unslant">{paying ? "OPENING CHECKOUT…" : `PAY ${fee} ▸`}</span>
          </button>
        ) : (
          <button className="btn-primary slant cr-next" autoFocus onClick={onDone}>
            <span className="unslant">BACK TO THE CITY ▸</span>
          </button>
        )}
      </div>
    </>
  );
}

/** "Become visible" — the gate, then character creation + profile, over the live street. */
export function Create() {
  const phase = useGame((s) => s.phase);
  const endCreate = useGame((s) => s.endCreate);
  const { step, draft: d, error, setStep, patch } = useOnboarding();
  const stage = useAccess((s) => s.stage);
  const path = useAccess((s) => s.path);
  const codeState = useAccess((s) => s.codeState);
  const member = useDirectory((s) => !!s.me);
  const panel = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState(0);
  const [signinEmail, setSigninEmail] = useState("");
  const signin = useAccess((s) => s.signin);
  const saving = useOnboarding((s) => s.mail === "sending" || s.saving);
  const paying = useAccess((s) => s.paying);
  const busy = saving || paying;
  const fee = useAccess((s) => s.fee);

  const keys: StepKey[] = stepsFor(member ? null : path);
  const key = keys[Math.min(step, keys.length - 1)];
  const last = keys.length - 1;

  const exit = () => {
    endCreate();
    requestLook();
  };
  const next = () => {
    const err = validateKey(key, d);
    if (err) return useOnboarding.setState({ error: err });
    if (step === last && !member) return useAccess.getState().finish();
    setStep(Math.min(last, step + 1));
  };
  const back = () => {
    if (step > 0) return setStep(step - 1);
    if (member) return exit();
    useAccess.getState().setStage(path === "invite" ? "code" : "gate");
  };

  // opening "Become visible": members skip the gate; an application in flight shows its status
  useEffect(() => {
    if (phase !== "create") return;
    useAccess.getState().open(useDirectory.getState().me != null);
    setSel(0);
    setSigninEmail(useOnboarding.getState().draft.email);
  }, [phase]);

  // the sign-in link was opened (here or in another tab) while this panel waits on "check your email":
  // a member is done — back to the street, no profile steps; an applicant sees where their application stands
  const userId = useDirectory((s) => s.userId);
  const loaded = useDirectory((s) => s.loaded);
  useEffect(() => {
    if (phase !== "create" || !userId || !loaded || useAccess.getState().stage !== "signin") return;
    if (useDirectory.getState().me) return exit();
    void useAccess.getState().loadApplication().then(() => useAccess.getState().open(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userId, loaded]);

  useEffect(() => {
    if (phase !== "create") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === "Escape") return exit();
      // answers: Shift+Enter is a new line, Enter alone moves on
      if (e.code === "Enter" && e.shiftKey && t.tagName === "TEXTAREA") return;
      const a = useAccess.getState();

      if (a.stage === "gate") {
        const to = (i: number) => OPTIONS[i]?.open && setSel(i);
        if (e.code === "ArrowDown" || e.code === "KeyS") to(1);
        if (e.code === "ArrowUp" || e.code === "KeyW") to(0);
        if (e.code === "Digit1" || e.code === "Digit2") to(e.code === "Digit1" ? 0 : 1);
        if (e.code === "Enter" && !e.repeat && OPTIONS[sel].open) {
          e.preventDefault();
          setStep(0);
          a.choose(OPTIONS[sel].path);
        }
        return;
      }
      if (a.stage === "code") {
        if (e.code === "Enter" && !e.repeat) {
          e.preventDefault();
          if (a.codeState === "ok") a.setStage("steps");
          else void a.checkCode();
        }
        return;
      }
      if (a.stage === "signin") {
        if (e.code === "Enter" && !e.repeat && a.signin !== "sent" && a.signin !== "sending") {
          e.preventDefault();
          void a.signIn(signinEmail);
        }
        return;
      }
      if (a.stage === "result") return;

      // Enter = Next, from anywhere on the step (fields, chips, toggles, spots).
      // The Back / Next / Go-live buttons keep their own Enter; held keys don't skip steps.
      if (e.code === "Enter" && !t.closest(".cr-nav") && (step < last || !member)) {
        e.preventDefault();
        if (!e.repeat) document.querySelector<HTMLButtonElement>(".cr-next")?.click(); // same path as clicking: validation + sound
        return;
      }

      // Pick your look: ← → / A D / ↑ ↓ all move through the styles.
      if (key === "look" && t.tagName !== "INPUT") {
        const dir =
          e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowUp"
            ? -1
            : e.code === "ArrowRight" || e.code === "KeyD" || e.code === "ArrowDown"
              ? 1
              : 0;
        if (!dir) return;
        e.preventDefault();
        const i = PLAYABLE.findIndex((c) => c.id === styleOf(d.character));
        patch({
          character: withGender(
            PLAYABLE[(i + dir + PLAYABLE.length) % PLAYABLE.length].id,
            d.gender,
          ),
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!isTouch) panel.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [step, stage]);

  if (phase !== "create") return null;
  const setStage = useAccess.getState().setStage;
  const tag = member && stage !== "signin"
    ? "EDIT PROFILE"
    : stage === "signin"
      ? "SIGN IN"
      : stage === "gate"
        ? "BECOME VISIBLE"
        : path === "invite"
          ? "BECOME VISIBLE · INVITED"
          : path === "pay"
            ? "BECOME VISIBLE · APPLICATION"
            : "BECOME VISIBLE";
  // a member who just signed in stays on the sign-in screen until the panel closes (never the profile steps)
  const gated = (!member || stage === "signin") && stage !== "steps";

  return (
    <div className="cr">
      <div className="select-shade" />
      <div className={`cr-panel${gated ? " cr-panel--gate" : ""}`} ref={panel} key={gated ? stage : `${path}-${step}`}>
        <div className="cr-top">
          <span className="cr-tag slant">
            <span className="unslant">{tag}</span>
          </span>
          {!gated && (
            <>
              <span className="cr-step">
                STEP {step + 1} / {keys.length}
              </span>
              <span className="cr-pips">
                {keys.map((_, i) => (
                  <span key={i} className={i <= step ? "on" : ""} />
                ))}
              </span>
            </>
          )}
        </div>

        {gated && stage === "gate" && <GateScreen sel={sel} setSel={setSel} />}
        {gated && stage === "code" && <CodeScreen />}
        {gated && stage === "result" && <ResultScreen onDone={exit} />}
        {gated && stage === "signin" && <SigninScreen email={signinEmail} setEmail={setSigninEmail} />}

        {!gated && <h2 className="cr-title">{STEP_TITLE[key]}</h2>}

        {!gated && key === "email" && (
          <div className="cr-fields">
            <label className="cr-field">
              <span className="cr-label">EMAIL</span>
              <input
                type="email"
                inputMode="email"
                value={d.email}
                placeholder="you@studio.com"
                autoComplete="email"
                spellCheck={false}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </label>
            <p className="cr-copy">
              {path === "invite"
                ? "Your one-tap sign-in link goes here once you’re done. No passwords."
                : "We’ll email you the review decision. Your sign-in link comes once you’re approved."}
            </p>
          </div>
        )}

        {!gated && key === "look" && <LookStep d={d} patch={patch} />}

        {!gated && key === "who" && (
          <div className="cr-fields">
            <Field
              label="NAME"
              value={d.name}
              onChange={(name) => patch({ name })}
              placeholder="Ananya Rao"
              max={40}
            />
            <Field
              label="ROLE"
              value={d.role}
              onChange={(role) => patch({ role })}
              placeholder="Product Designer"
              max={60}
            />
            <Field
              label="COMPANY"
              hint="optional"
              value={d.company}
              onChange={(company) => patch({ company })}
              placeholder="Where you work"
              max={60}
            />
          </div>
        )}

        {!gated && key === "building" && (
          <div className="cr-fields">
            <Field
              label="CURRENTLY BUILDING"
              hint="optional"
              value={d.building}
              onChange={(building) => patch({ building })}
              placeholder="A side project, a startup, a design system…"
              max={80}
            />
            <Field
              label="PREVIOUSLY"
              hint="optional"
              value={d.previously}
              onChange={(previously) => patch({ previously })}
              placeholder="Past teams or studios"
              max={80}
            />
            <Field
              label="SKILLS"
              hint="comma separated"
              value={d.skills}
              onChange={(skills) => patch({ skills })}
              placeholder="Figma, Motion, Design systems"
              max={120}
            />
            <button
              className={`cr-toggle${d.openToWork ? " cr-toggle--on" : ""}`}
              onClick={() => patch({ openToWork: !d.openToWork })}
            >
              <span className="cr-switch" />
              <span>
                <b>OPEN TO WORK</b>
                <em>Shows a green tag on your nameplate</em>
              </span>
            </button>
          </div>
        )}

        {!gated && key === "links" && (
          <div className="cr-fields">
            <Field
              label="PORTFOLIO"
              hint="optional"
              value={d.portfolio}
              onChange={(portfolio) => patch({ portfolio })}
              placeholder="yourname.design"
              max={200}
            />
            <Field
              label="LINKEDIN"
              hint="optional"
              value={d.linkedin}
              onChange={(linkedin) => patch({ linkedin })}
              placeholder="linkedin.com/in/you"
              max={200}
            />
            <Field
              label="X"
              hint="optional"
              value={d.x}
              onChange={(x) => patch({ x })}
              placeholder="@handle"
              max={60}
            />
          </div>
        )}

        {!gated && key === "hangout" && (
          <div className="cr-fields">
            <span className="cr-label">YOUR NEIGHBOURHOOD</span>
            <div className="cr-chips cr-chips--tight">
              {DISTRICTS.map((n) => (
                <button
                  key={n.id}
                  className={`chip slant${districtOfLocation(d.location).id === n.id ? " chip--on" : ""}`}
                  onClick={() =>
                    patch({
                      location: n.name,
                      // keep the spot if it exists there, otherwise that district's first spot
                      spot: d.spot in spotsFor(n.name) ? d.spot : Object.keys(spotsFor(n.name))[0],
                    })
                  }
                >
                  <span className="unslant chip-name">{n.title}</span>
                </button>
              ))}
            </div>
            {!districtOfLocation(d.location).built && (
              <span className="cr-gender-note" style={{ margin: "8px 0 0" }}>
                {districtOfLocation(d.location).title} isn’t built yet. You’ll be visiting Koramangala until it is.
              </span>
            )}
            <span className="cr-label" style={{ marginTop: 18 }}>
              WHERE YOU’LL BE FOUND IN {districtInfoTitle(d.location)}
            </span>
            <div className="cr-spots">
              {Object.entries(spotsFor(d.location)).map(([id, sp]) => (
                <button
                  key={id}
                  className={`cr-spot${d.spot === id ? " cr-spot--on" : ""}`}
                  onClick={() => patch({ spot: id })}
                >
                  <b>{sp.label}</b>
                  <em>{sp.blurb}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        {!gated && key === "golive" && (member ? <GoLiveStep d={d} /> : <InviteGoLive d={d} />)}
        {!gated && (key === "why" || key === "want" || key === "bring") && (
          <QuestionStep k={key} d={d} patch={patch} />
        )}
        {!gated && key === "show" && <ShowStep d={d} patch={patch} />}
        {!gated && key === "pay" && <PayStep d={d} />}

        {error && <div className="cr-error">{error}</div>}

        {stage === "gate" && gated && (
          <div className="cr-nav">
            <button className="pp-btn slant cr-back" onClick={exit}>
              <span className="unslant">NOT NOW · STAY A GHOST</span>
            </button>
            <span className="gate-keys">
              <span className="keycap">↑</span>
              <span className="keycap">↓</span> CHOOSE <span className="keycap keycap--wide">ENTER</span>
            </span>
          </div>
        )}

        {stage === "code" && gated && (
          <div className="cr-nav">
            <button className="pp-btn slant cr-back" onClick={() => setStage("gate")}>
              <span className="unslant">◀ BACK</span>
            </button>
            <button className="btn-primary slant cr-next" disabled={codeState !== "ok"} onClick={() => setStage("steps")}>
              <span className="unslant">CONTINUE ▸</span>
            </button>
          </div>
        )}

        {stage === "signin" && gated && (
          <div className="cr-nav">
            <button className="pp-btn slant cr-back" onClick={() => setStage("gate")}>
              <span className="unslant">◀ BACK</span>
            </button>
            {signin === "sent" ? (
              <button className="btn-primary slant cr-next" autoFocus onClick={exit}>
                <span className="unslant">BACK TO THE CITY ▸</span>
              </button>
            ) : (
              <button
                className="btn-primary slant cr-next"
                disabled={signin === "sending"}
                onClick={() => useAccess.getState().signIn(signinEmail)}
              >
                <span className="unslant">{signin === "sending" ? "SENDING…" : "SEND MY LINK ▸"}</span>
              </button>
            )}
          </div>
        )}

        {!gated && (
          <div className="cr-nav">
            <button className="pp-btn slant cr-back" onClick={back}>
              <span className="unslant">◀ BACK</span>
            </button>
            {(step < last || !member) && (
              <button className="btn-primary slant cr-next" onClick={next} disabled={step === last && busy}>
                <span className="unslant">
                  {step < last ? "NEXT ▸" : busy ? "ONE MOMENT…" : key === "pay" ? `SUBMIT + PAY ${fee} ▸` : "GO LIVE ▸"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
