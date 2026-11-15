import { db, statusMessage } from "./supabase-client.js";
const form = document.getElementById("reset-form");
const feedback = document.getElementById("reset-feedback");
const submit = document.getElementById("reset-submit");
form.addEventListener("submit", async event => {
  event.preventDefault();
  const first = document.getElementById("new-password").value;
  const second = document.getElementById("confirm-password").value;
  if (first !== second) {
    statusMessage(feedback, "The passwords don't match.", true);
    return;
  }
  submit.disabled = true;
  statusMessage(feedback, "");
  try {
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("This reset link has expired or is invalid. Request another from the login page.");
    const { error } = await db.auth.updateUser({ password: first });
    if (error) throw error;
    await db.auth.signOut();
    form.reset();
    statusMessage(feedback, "Password changed. Return to login with your new password.");
  } catch (error) {
    statusMessage(feedback, error.message || "Password reset failed.", true);
  } finally {
    submit.disabled = false;
  }
});
