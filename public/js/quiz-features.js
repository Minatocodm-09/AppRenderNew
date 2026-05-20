// Shared quiz enhancements: auth bar, streak, emoji popups, leaderboard submission.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";

const SUPABASE_URL = "https://zspcixpgjhvrzynfraxh.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzcGNpeHBnamh2cnp5bmZyYXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NzExMDAsImV4cCI6MjA5NDU0NzEwMH0.UVBW-N0Yvx2kh9YCZ-mG8NMf9FyQhjiyVL_VX69pnhM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: localStorage },
});
window.aprenderSupabase = supabase;

// ===== Styles =====
const css = document.createElement("style");
css.textContent = `
.aprender-bar{position:sticky;top:0;z-index:50;display:flex;gap:12px;align-items:center;
  justify-content:flex-end;padding:10px 16px;background:rgba(15,23,42,.85);
  backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.1);
  font-family:Arial,Helvetica,sans-serif;color:#fff;font-size:.95rem;flex-wrap:wrap}
.aprender-bar .ap-streak{margin-right:auto;display:flex;align-items:center;gap:8px;
  background:linear-gradient(135deg,#f59e0b,#ef4444);padding:6px 14px;border-radius:999px;
  font-weight:700;box-shadow:0 4px 12px rgba(239,68,68,.3)}
.aprender-bar .ap-link{color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);cursor:pointer;
  font-size:.9rem;font-weight:600}
.aprender-bar .ap-link:hover{background:rgba(255,255,255,.18)}
.aprender-bar .ap-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none}
.ap-emoji-pop{position:fixed;top:50%;left:50%;font-size:7rem;
  transform:translate(-50%,-50%) scale(0);pointer-events:none;z-index:9999;
  text-shadow:0 8px 24px rgba(0,0,0,.4);
  animation:apPop 1.2s cubic-bezier(.34,1.56,.64,1) forwards}
@keyframes apPop{
  0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0}
  30%{transform:translate(-50%,-50%) scale(1.3) rotate(10deg);opacity:1}
  60%{transform:translate(-50%,-50%) scale(1) rotate(0);opacity:1}
  100%{transform:translate(-50%,-200%) scale(.6);opacity:0}
}
.ap-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
  background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;z-index:9999;
  box-shadow:0 8px 24px rgba(0,0,0,.3);font-family:Arial,sans-serif}
`;
document.head.appendChild(css);

// ===== Top bar =====
const category =
  document.querySelector('meta[name="quiz-category"]')?.content ||
  document.title.split("|")[0].trim();

const bar = document.createElement("div");
bar.className = "aprender-bar";
bar.innerHTML = `
  <div class="ap-streak" id="apStreak">🔥 Streak: <span id="apStreakNum">0</span></div>
  <a class="ap-link" href="/leaderboard.html">🏆 Leaderboard</a>
  <span id="apAuthSlot"></span>
`;
document.body.prepend(bar);

const authSlot = bar.querySelector("#apAuthSlot");
async function renderAuth() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const name = prof?.display_name || user.email;
    authSlot.innerHTML = `<span style="margin-right:8px;opacity:.85">👤 ${name}</span>
      <button class="ap-link" id="apSignOut">Sign out</button>`;
    authSlot.querySelector("#apSignOut").onclick = async () => {
      await supabase.auth.signOut();
      location.reload();
    };
  } else {
    authSlot.innerHTML = `<a class="ap-link ap-primary" href="/auth.html">Sign in</a>`;
  }
}
renderAuth();
supabase.auth.onAuthStateChange(() => renderAuth());

// ===== Streak + emoji + score submission =====
let streak = 0;
let bestStreak = 0;
let currentDifficulty = null;

function popEmoji(emoji) {
  const el = document.createElement("div");
  el.className = "ap-emoji-pop";
  el.textContent = emoji;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "ap-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function updateStreakUI() {
  document.getElementById("apStreakNum").textContent = streak;
}

// Wrap startQuiz / checkAnswer / showResult after page scripts load.
function wrap() {
  const origStart = window.startQuiz;
  if (typeof origStart === "function") {
    window.startQuiz = function (level) {
      currentDifficulty = level;
      streak = 0;
      bestStreak = 0;
      updateStreakUI();
      return origStart.apply(this, arguments);
    };
  }

  const origCheck = window.checkAnswer;
  if (typeof origCheck === "function") {
    window.checkAnswer = function (button, selected) {
      // Determine correctness using same logic the page uses.
      const cq = window.currentQuiz?.[window.currentQuestion];
      const correct = cq && selected === cq.answer;
      if (correct) {
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        popEmoji("😄");
      } else {
        streak = 0;
        popEmoji("😢");
      }
      updateStreakUI();
      return origCheck.apply(this, arguments);
    };
  }

  const origResult = window.showResult;
  if (typeof origResult === "function") {
    window.showResult = async function () {
      const ret = origResult.apply(this, arguments);
      try {
        const total = window.currentQuiz?.length ?? 0;
        const score = window.score ?? 0;
        const { data: s } = await supabase.auth.getSession();
        if (s.session?.user && total > 0) {
          await supabase.from("scores").insert({
            user_id: s.session.user.id,
            category,
            difficulty: currentDifficulty || "unknown",
            score,
            total,
            best_streak: bestStreak,
          });
          // Append leaderboard CTA to result box
          const rb = document.getElementById("resultBox");
          if (rb && !rb.querySelector(".ap-saved")) {
            const p = document.createElement("p");
            p.className = "ap-saved";
            p.style.cssText = "margin-top:12px;color:#5CDB95;font-weight:600";
            p.innerHTML = `✅ Score saved! Best streak: 🔥 ${bestStreak}
              <br><a href="/leaderboard.html?cat=${encodeURIComponent(category)}"
              style="color:#74B9FF;display:inline-block;margin-top:8px">View Leaderboard →</a>`;
            rb.appendChild(p);
          }
        } else if (!s.session?.user) {
          toast("Sign in to save your score to the leaderboard!");
        }
      } catch (e) {
        console.error("score save failed", e);
      }
      return ret;
    };
  }
}

// Page inline script runs before this module (defer/type=module loads after),
// so functions are already defined on window.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wrap);
} else {
  wrap();
}
