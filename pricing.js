import { db } from "./supabase-client.js";

const root = document.getElementById("pricing-grid");
const featureDescriptions = {
  free: "A peaceful starting place for your first few learners.",
  starter: "For independent tutors growing a steady student list.",
  growth: "For busy tutors managing many learners and lessons.",
  studio: "For high-volume independent tutors managing larger student lists."
};
function card(plan) {
  const article = document.createElement("article");
  article.className = "plan-card" + (plan.code === "growth" ? " is-popular" : "");
  if (plan.code === "growth") {
    const badge = document.createElement("div");
    badge.className = "plan-popular";
    badge.textContent = "Popular choice";
    article.append(badge);
  }
  const heading = document.createElement("div");
  const name = document.createElement("h2");
  name.className = "plan-title";
  name.textContent = plan.name;
  const desc = document.createElement("p");
  desc.className = "plan-desc";
  desc.textContent = featureDescriptions[plan.code] || "A simple private workspace.";
  heading.append(name, desc);

  const price = document.createElement("div");
  price.className = "plan-price";
  const amount = document.createElement("strong");
  amount.textContent = "R" + new Intl.NumberFormat("en-ZA").format(plan.monthly_price_zar);
  const per = document.createElement("small");
  per.textContent = "/month";
  price.append(amount, per);
  const tag = document.createElement("span");
  tag.className = "plan-tag";
  tag.textContent = plan.code === "free" ? "Available now" : "Planned subscription · not yet billed";

  const action = document.createElement("a");
  action.className = "plan-action";
  action.href = plan.code === "free" ? "register.html"
    : "mailto:helloearthsupport@gmail.com?subject=" + encodeURIComponent("HelloEarth " + plan.name + " plan interest");
  action.textContent = plan.code === "free" ? "Start for free →" : "Ask about launch →";

  const list = document.createElement("ul");
  list.className = "plan-features";
  const features = [
    "Up to " + plan.max_students + " student profiles",
    "Up to " + new Intl.NumberFormat("en-ZA").format(plan.max_notes_monthly) + " new notes per month",
    new Intl.NumberFormat("en-ZA").format(plan.max_notes_total) + " notes stored in total",
    "Private Google / email sign-in",
    "CEFR levels, goals and student history"
  ];
  for (const feature of features) {
    const li = document.createElement("li");
    li.textContent = feature;
    list.append(li);
  }
  article.append(heading, price, tag, action, list);
  return article;
}

async function loadPrices() {
  try {
    const { data, error } = await db.from("helloearth_plans")
      .select("code,name,monthly_price_zar,max_students,max_notes_monthly,max_notes_total,display_order")
      .eq("public_visible", true)
      .order("display_order", { ascending: true });
    if (error) throw error;
    if (!data?.length) throw new Error("No plans published");
    root.replaceChildren(...data.map(card));
  } catch (_) {
    root.replaceChildren();
    const notice = document.createElement("p");
    notice.className = "pricing-loading";
    notice.textContent = "Plan details are temporarily unavailable. Please contact helloearthsupport@gmail.com for the latest information.";
    root.append(notice);
  }
}
loadPrices();
