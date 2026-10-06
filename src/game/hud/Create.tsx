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
  PAY_OPEN,
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
  PAY_OPEN
    ? { path: "pay", n: "02", title: "APPLY TO JOIN", badge: "REVIEWED", blurb: "Build your profile, pay the application fee, and we review it. Not approved? Full refund.", open: true }
    : { path: "pay", n: "02", title: "APPLY TO JOIN", badge: "COMING SOON", blurb: "Applications open soon. Until then, the way in is an invite from a member.", open: false },
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
          {PAY_OPEN && <button
            className="gate-switch"
            onClick={() => {
              setStep(0);
              choose("pay");
            }}
          >
            APPLY INSTEAD ▸
          </button>}
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

/** Pay path, last step: the payment placeholder (Dodo Payments comes in 5D-C). */
function PayStep({ d }: { d: Draft }) {
  return (
    <div className="cr-live">
      <Summary d={d} />
      <div className="gate-pay slant">
        <span className="unslant gate-pay-body">
          <span className="gate-pay-k">APPLICATION FEE</span>
          <span className="gate-pay-v">₹ —</span>
          <span className="gate-pay-note">PAYMENT · COMING SOON — nothing is charged in this preview</span>
        </span>
      </div>
      <ol className="gate-next">
        <li><b>WE REVIEW</b> your profile. You stay a ghost meanwhile.</li>
        <li><b>APPROVED</b> — we email {d.email || "you"} a sign-in link and you go live.</li>
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
            <p>The reviewer’s reason appears here.</p>
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
        {result === "review" || result === "rejected" ? (
          <button className="pp-btn slant cr-back" onClick={useCode}>
            <span className="unslant">I HAVE A CODE</span>
          </button>
        ) : (
          <span />
        )}
        <button className="btn-primary slant cr-next" autoFocus onClick={onDone}>
          <span className="unslant">BACK TO THE CITY ▸</span>
        </button>
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
  const busy = useOnboarding((s) => s.mail === "sending" || s.saving);

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
  }, [phase]);

  useEffect(() => {
    if (phase !== "create") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === "Escape") return exit();
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
    if (!isTouch) panel.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [step, stage]);

  if (phase !== "create") return null;
  const setStage = useAccess.getState().setStage;
  const tag = member ? "EDIT PROFILE" : path === "invite" ? "BECOME VISIBLE · INVITED" : path === "pay" ? "BECOME VISIBLE · APPLICATION" : "BECOME VISIBLE";
  const gated = !member && stage !== "steps";

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

        {!gated && (
          <div className="cr-nav">
            <button className="pp-btn slant cr-back" onClick={back}>
              <span className="unslant">◀ BACK</span>
            </button>
            {(step < last || !member) && (
              <button className="btn-primary slant cr-next" onClick={next} disabled={step === last && busy}>
                <span className="unslant">
                  {step < last ? "NEXT ▸" : busy ? "ONE MOMENT…" : key === "pay" ? "SUBMIT APPLICATION ▸" : "GO LIVE ▸"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
