import { db, statusMessage } from "./supabase-client.js";

const register = document.body.dataset.page === "register";
const form = document.getElementById("auth-form");
const feedback = document.getElementById("auth-feedback");
const submit = document.getElementById("submit-auth");
const google = document.getElementById("google-signin");
const redirect = new URL("dashboard.html", window.location.href).href;

async function checkExistingSession() {
  const { data: { user } } = await db.auth.getUser();
  if (user) window.location.replace("dashboard.html");
}
checkExistingSession().catch(() => {});

function busy(button, active) {
  button.disabled = active;
  button.classList.toggle("is-loading", active);
}
function errorText(err) {
  const message = String(err?.message || err || "Something went wrong.");
  if (/provider.+not.enabled|unsupported.provider/i.test(message)) return "Google login is not enabled yet. Please use email sign-in or contact support.";
  if (/invalid.login.credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email.not.confirmed/i.test(message)) return "Please verify your email first, then sign in.";
  if (/rate.limit|too.many.requests/i.test(message)) return "Too many attempts. Please try again later.";
  return message.length > 220 ? "We couldn't complete the request. Please try again." : message;
}
document.querySelectorAll(".toggle-password").forEach(button => {
  button.addEventListener("click", () => {
    const input = document.getElementById("password");
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Show" : "Hide";
    button.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
  });
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  busy(submit, true);
  statusMessage(feedback, "");
  try {
    const email = form.email.value.trim();
    const password = form.password.value;
    if (register) {
      if (!document.getElementById("accept-terms").checked) {
        throw new Error("Please accept the Terms and Privacy Policy.");
      }
      const name = document.getElementById("name").value.trim();
      if (!name) throw new Error("Please enter your name.");
      const { data, error } = await db.auth.signUp({
        email, password,
        options: {
          data: { display_name: name },
          emailRedirectTo: redirect
        }
      });
      if (error) throw error;
      if (data.session) {
        window.location.replace("dashboard.html");
      } else {
        statusMessage(feedback, "Check your inbox for a confirmation link, then sign in. If the address already has an account, use the login page.");
        form.reset();
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.replace("dashboard.html");
    }
  } catch (error) {
    statusMessage(feedback, errorText(error), true);
  } finally {
    busy(submit, false);
  }
});

google.addEventListener("click", async () => {
  busy(google, true);
  statusMessage(feedback, "");
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect }
    });
    if (error) throw error;
  } catch (error) {
    statusMessage(feedback, errorText(error), true);
    busy(google, false);
  }
});

const forgot = document.getElementById("forgot-password");
if (forgot) forgot.addEventListener("click", async event => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  if (!email) {
    statusMessage(feedback, "Enter your email address above, then choose Forgot password.", true);
    document.getElementById("email").focus();
    return;
  }
  try {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("reset-password.html", window.location.href).href
    });
    if (error) throw error;
    statusMessage(feedback, "If an account exists for this email, you'll receive a password reset link.");
  } catch (error) {
    statusMessage(feedback, errorText(error), true);
  }
});
