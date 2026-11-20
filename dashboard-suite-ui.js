/* Static UI for the authenticated HelloEarth tutor-tool workspace. */
const card=(name,subtitle,body,open=false)=>'<details class="he-suite-card" '+(open?'open':'')+'><summary><span><strong>'+name+'</strong><small>'+subtitle+'</small></span><span aria-hidden="true">⌄</span></summary><div class="he-suite-card-body">'+body+'</div></details>';
const studentSelect=(name="student_id",required=true)=>'<label>Student<select name="'+name+'" data-suite-students '+(required?'required':'')+'><option value="">Choose a student</option></select></label>';
const btn=(id,label,cls="ws-mini-btn")=>'<button type="button" id="'+id+'" class="'+cls+'">'+label+'</button>';
const dayOptions=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d,i)=>'<option value="'+i+'" '+(i===1?'selected':'')+'>'+d+'</option>').join("");
export function renderSuite(){
 document.getElementById("he-suite-schedule").innerHTML=[
  card("Public booking page (optional)","Manage existing personal request links; not part of the core student database.",
   '<form id="he-suite-settings" class="he-suite-grid">'+
    '<label>Booking URL slug<input name="public_slug" maxlength="32" placeholder="your-tutor-name" pattern="[a-z0-9][a-z0-9-]{2,31}"></label>'+
    '<label>Business / tutor display name<input name="display_label" maxlength="85" required value="Independent tutor"></label>'+
    '<label>Your timezone<input name="timezone" maxlength="80" required value="Africa/Johannesburg"></label>'+
    '<label>Lesson duration<select name="slot_minutes"><option value="30">30 min</option><option value="50" selected>50 min</option><option value="60">60 min</option><option value="90">90 min</option></select></label>'+
    '<label>Day starts<input type="time" name="work_start" value="09:00" required></label>'+
    '<label>Day ends<input type="time" name="work_end" value="17:00" required></label>'+
    '<label>Break between lessons<select name="buffer_minutes"><option value="0">None</option><option value="10" selected>10 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label>'+
    '<label>Default hourly rate<input type="number" min="0" step=".01" name="hourly_rate" value="0"></label>'+
    '<label>Currency<select name="currency"><option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option><option>PLN</option></select></label>'+
    '<fieldset class="he-suite-days"><legend>Accept bookings</legend>'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d,i)=>'<label><input type="checkbox" name="weekday" value="'+i+'" '+(i>=1&&i<=5?'checked':'')+'>'+d+'</label>').join("")+'</fieldset>'+
    '<label class="he-suite-check"><input type="checkbox" name="booking_enabled"><span>Enable public booking requests (off by default)</span></label>'+
    '<div class="he-suite-actions"><button type="submit" class="dash-primary">Save settings</button>'+btn("he-suite-copy-booking","Copy link")+'<a id="he-suite-booking-preview" href="booking.html" target="_blank" rel="noopener noreferrer" class="ws-mini-btn">Open booking page</a></div>'+
    '<p class="he-suite-note">The public page accepts requests, not confirmed lessons. Google Calendar events are not read or created by public visitors. Approve requests only after checking your real schedule.</p>'+
   '</form>',false),
  card("Booking requests","Review, accept or decline new requests.",'<div id="he-suite-bookings" class="he-suite-list">Loading requests…</div>',true),
  card("Recurring student lessons","Save weekly patterns and send a chosen pattern to Google Calendar.",
   '<form id="he-suite-recurring" class="he-suite-grid">'+studentSelect()+
    '<label>Repeat every<select name="weekday">'+dayOptions+'</select></label>'+
    '<label>Local start time<input type="time" name="local_start" value="15:00" required></label>'+
    '<label>Lesson duration<select name="duration_minutes"><option>30</option><option selected>50</option><option>60</option><option>90</option></select></label>'+
    '<label>Timezone<input name="timezone" required maxlength="80" value="Africa/Johannesburg"></label>'+
    '<label>Start date<input name="starts_on" type="date" required></label>'+
    '<label>End date (optional)<input name="ends_on" type="date"></label>'+
    '<div class="he-suite-actions"><button type="submit" class="dash-primary">Save recurring pattern</button></div></form>'+
    '<p class="he-suite-note">Saved rules block matching public booking slots. Use the Google Calendar button to create the next 26 repeating events explicitly; check for clashes first.</p>'+
    '<div class="he-suite-list" id="he-suite-recurring-list"></div>',false),
  card("Smart scheduling suggestions","Find gaps in the most recently synced Google Calendar week.",
   '<div class="he-suite-actions"><label>Duration<select id="he-suite-suggest-duration"><option value="30">30 min</option><option value="50" selected>50 min</option><option value="60">60 min</option></select></label>'+btn("he-suite-suggest","Find open times")+'</div>'+
   '<div id="he-suite-suggestions" class="he-suite-list">Connect Google Calendar to see available gaps.</div>'+
   '<p class="he-suite-note">Suggestions are based on the calendar week that was actually synced. Other dates and inaccessible calendars are not verified.</p>',true),
  card("Calendar-to-student linking","Find linked appointments and confirm suggested student matches.",
   '<div id="he-suite-calendar-links" class="he-suite-list">Connect Google Calendar to match scheduled lessons to student profiles.</div>',false)
 ].join("");
 document.getElementById("he-suite-students").innerHTML=[
  card("Homework dashboard","Assign homework and follow up on overdue or completed tasks.",
   '<form id="he-suite-homework-form" class="he-suite-grid">'+studentSelect()+
   '<label>Due date<input type="date" name="due_on"></label>'+
   '<label class="he-suite-wide">Assignment<textarea name="title" required rows="2" maxlength="800" placeholder="Write five past tense sentences…"></textarea></label>'+
   '<div class="he-suite-actions"><button class="dash-primary" type="submit">Assign homework</button></div></form>'+
   '<div id="he-suite-homework-list" class="he-suite-list"></div>',true),
  card("Lesson preparation checklist","Keep a practical checklist for each student's next lesson.",
   '<form id="he-suite-prep" class="he-suite-grid">'+studentSelect()+
   '<fieldset class="he-suite-checklist he-suite-wide"><legend>Before the next lesson</legend>'+
   ['review_notes|Review the last lesson','check_homework|Check homework','confirm_goals|Confirm learning goals',
    'prepare_materials|Prepare teaching materials','confirm_schedule|Check date and timezone'].map(x=>{const [name,label]=x.split("|");return '<label><input type="checkbox" name="'+name+'">'+label+'</label>'}).join("")+
   '</fieldset><label class="he-suite-wide">Preparation note<textarea name="preparation_note" maxlength="1500" rows="3" placeholder="Start with…"></textarea></label>'+
   '<div class="he-suite-actions"><button class="dash-primary" type="submit">Save checklist</button>'+btn("he-suite-open-student","Open selected profile")+'</div></form>',false),
  card("Search student records","Search profiles, notes, plans and homework across your private workspace.",
   '<div class="he-suite-actions"><label class="he-suite-search">Search<input type="search" id="he-suite-search-input" maxlength="100" placeholder="Search topics, goals, names or mistakes"></label>'+btn("he-suite-search","Search records")+'</div>'+
   '<div id="he-suite-search-results" class="he-suite-list">Enter a term to search.</div>',true),
  card("Student timezone & personal portal","Choose a learner's timezone and create a private, expiring summary link.",
   '<form id="he-suite-student-settings" class="he-suite-grid">'+studentSelect()+
   '<label>Student timezone<input name="timezone" required maxlength="80" value="UTC" placeholder="Europe/Warsaw"></label>'+
   '<label>Contact email (not shared)<input type="email" maxlength="240" name="contact_email"></label>'+
   '<label>Default hourly rate<input type="number" name="default_rate" min="0" step=".01" max="100000"></label>'+
   '<div class="he-suite-actions"><button type="submit" class="dash-primary">Save preferences</button></div></form>'+
   '<div id="he-suite-timezone" class="he-suite-timezone"></div>'+
   '<div class="he-suite-actions">'+btn("he-suite-create-portal","Create 30-day student link")+' '+btn("he-suite-revoke-portal","Revoke link")+'</div>'+
   '<p class="he-suite-note">Anyone who has the portal link can see a limited summary. Send it only to the learner or parent. It expires after 30 days or can be revoked.</p>'+
   '<div id="he-suite-portal-result" class="he-suite-result"></div>',false)
 ].join("");
 document.getElementById("he-suite-business").innerHTML=[
  card("Student progress reports","Export saved student assessments and notes in a printable report or CSV.",
   '<div class="he-suite-actions"><label>Student<select id="he-suite-report-student" data-suite-students></select></label>'+
   btn("he-suite-report-print","Print / Save PDF","dash-primary")+btn("he-suite-report-csv","Download data CSV")+'</div>'+
   '<p class="he-suite-note">Review the report before sharing. Skill scores are tutor observations, not automatic CEFR certifications.</p>',true),
  card("Weekly activity summary","Review saved student-support and lesson activity.",
   '<div class="he-suite-actions"><label>Week including<input type="date" id="he-suite-week-date"></label>'+
   btn("he-suite-review","Refresh review")+btn("he-suite-review-export","Download summary")+'</div><div id="he-suite-week-summary" class="he-suite-metrics"></div>'+
   '<p class="he-suite-note">Only recorded lessons are counted as completed—not just calendar appointments.</p>',false),
  card("Optional lesson ledger","Keep optional historic lesson, attendance and payment records.",
   '<form id="he-suite-ledger-form" class="he-suite-grid">'+studentSelect("student_id",false)+
   '<label>Lesson date<input name="lesson_date" type="date" required></label>'+
   '<label>Duration (minutes)<input type="number" min="5" max="480" name="duration_minutes" value="50" required></label>'+
   '<label>Amount<input type="number" name="amount" min="0" max="100000" value="0" step=".01" required></label>'+
   '<label>Currency<select name="currency"><option>ZAR</option><option>USD</option><option>EUR</option><option>GBP</option><option>PLN</option></select></label>'+
   '<label>Status<select name="state"><option value="completed">Completed</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></label>'+
   '<label class="he-suite-check"><input type="checkbox" name="paid"><span>Payment received</span></label>'+
   '<label class="he-suite-wide">Note<input name="note" maxlength="600" placeholder="Optional"></label>'+
   '<div class="he-suite-actions"><button type="submit" class="dash-primary">Record lesson / payment</button>'+btn("he-suite-ledger-export","Export ledger CSV")+'</div></form>'+
   '<div id="he-suite-earnings" class="he-suite-metrics"></div><div id="he-suite-ledger-list" class="he-suite-list"></div>'+
   '<p class="he-suite-note">Amounts remain separated by currency; no exchange conversion is assumed. Payments are records, not processed transactions.</p>',false)
 ].join("");
 document.getElementById("he-suite-resources").innerHTML=[
  card("Teaching templates library","Save and reuse lesson formats without relying on Atlas AI.",
   '<form id="he-suite-template-form" class="he-suite-grid">'+
   '<label>Template title<input name="title" required maxlength="120" placeholder="Opinion and fluency lesson"></label>'+
   '<label>Level<select name="cefr"><option>ALL</option><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option><option>C2</option></select></label>'+
   '<label class="he-suite-wide">Editable template<textarea name="content" rows="7" minlength="15" maxlength="12000" required placeholder="# Warm-up\n..."></textarea></label>'+
   '<div class="he-suite-actions"><button type="submit" class="dash-primary">Save template</button></div></form>'+
   '<div id="he-suite-templates" class="he-suite-list"></div>',true),
  card("Cancellations & no-show tracking","Record attended, missed and cancelled lessons after the scheduled date.",
   '<form id="he-suite-attendance-form" class="he-suite-grid">'+studentSelect()+
   '<label>Lesson date<input type="date" name="lesson_date" required></label>'+
   '<label>Status<select name="status"><option value="attended">Attended</option><option value="missed">No-show / missed</option><option value="cancelled">Cancelled</option></select></label>'+
   '<label class="he-suite-wide">Reason / follow-up<input name="note" maxlength="500"></label>'+
   '<div class="he-suite-actions"><button type="submit" class="dash-primary">Record attendance</button></div></form>'+
   '<div id="he-suite-attendance-list" class="he-suite-list"></div>',false)
 ].join("");
}
