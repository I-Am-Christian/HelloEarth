import {renderWorkbook} from "./helloearth-workbook-renderer.js";
// A curated visual example, not generated student content.
const text=String.raw`# Helicopters — Vocabulary & Speaking
**Level:** A1 | **Duration:** 50 minutes | **Focus:** Vocabulary, pronunciation, speaking

## Learning Objectives
By the end of the lesson, the learner can:
- Name at least eight helicopter-related objects or actions.
- Say five simple sentences with **It has**, **It can**, or **It can't**.
- Ask and answer three simple questions about helicopters.
- Identify key information in a short listening passage.

## Key Vocabulary
| Word | Simple meaning | Example sentence |
|---|---|---|
| helicopter | A flying machine with spinning blades. | The helicopter is in the sky. |
| blade | A long part that turns at the top. | The blades spin fast. |
| pilot | A person who flies a helicopter. | The pilot is happy. |
| tail | The back part of a helicopter. | The helicopter has a tail. |
| cockpit | Where the pilot sits. | The pilot sits in the cockpit. |
| passenger | A person travelling inside. | The passenger looks out. |
| fly | To move in the air. | Helicopters can fly. |
| land | To come down to the ground. | The helicopter lands. |
| hover | To stay in one place in the air. | It can hover. |
| rescue | To help somebody in danger. | A rescue team helps people. |
| helipad | A place for helicopter landing. | The helipad is near the hospital. |
| sky | The space above us. | The sky is blue. |

## Pronunciation & Language Focus
Say each word. Clap on the stressed syllable:
- **HEL**-i-cop-ter
- **PI**-lot
- **PAS**-sen-ger

**It has / It doesn't have:**
- It has a tail.
- It has a cockpit.
- It doesn't have boat sails.

**It can / It can't:**
- A helicopter can fly.
- A helicopter can hover.
- It can't swim like a fish.

## Warm-Up (5 minutes)
Answer Yes or No:
1. A bird can fly.
2. A helicopter can swim.
3. A helicopter has blades.
4. A car can hover like a helicopter.

Say one sentence: **I can see a helicopter at ______.**

## Vocabulary Discovery (10 minutes)
Read and repeat the word bank. Then choose the correct word.

**Word bank:** pilot, tail, helicopter, helipad, passenger, blades, sky, cockpit

1. The ______ flies the helicopter.
2. The ______ is behind the helicopter.
3. A ______ carries people through the air.
4. The ______ is where the pilot sits.
5. The ______ is a place where a helicopter lands.
6. The ______ are on the top of the helicopter.
7. The helicopter flies in the ______.
8. A ______ sits inside the helicopter.

## Guided Practice (12 minutes)
Complete the sentences with **has**, **can** or **can't**.

1. A helicopter ______ fly.
2. It ______ a tail.
3. It ______ hover in the air.
4. A helicopter ______ swim like a fish.
5. It ______ a cockpit.
6. It ______ land on a helipad.
7. It ______ passengers.
8. It ______ turn its blades.

Now ask your tutor:
- Can a helicopter hover?
- Does it have a pilot?
- Where can it land?

## Speaking Practice (10 minutes)
**Role-play: Pilot and Passenger**

Passenger: Hello! Can this helicopter fly high?
Pilot: Yes, it can.
Passenger: Can it land near the hospital?
Pilot: Yes, it can land on the helipad.
Passenger: Does it have a big tail?
Pilot: Yes, it does.

Swap roles. Use three new questions starting with **Can it…?** or **Does it have…?**

## Listening Task (8 minutes)
Your tutor reads this passage twice. Listen and answer the questions.

**Listening passage:**
> Mia is a helicopter pilot. Today she flies over a town. There are two passengers in the helicopter. The sky is blue. Mia sees a hospital. The hospital has a small helipad. She makes the helicopter hover for a moment, then she lands safely. The passengers say, “Thank you, Mia!”

**Questions**
1. Is Mia a pilot or a passenger?
2. How many passengers are there?
3. What colour is the sky?
4. Where does Mia land?
5. Does she land safely?

## Homework (5–10 minutes)
Write five sentences about a helicopter. Use **has**, **can**, or **can't**.

Then complete:
1. A helicopter ______ fly.
2. It ______ a pilot.
3. It ______ swim like a fish.

## Answer Key
**Warm-up:** 1 Yes; 2 No; 3 Yes; 4 No.

**Vocabulary Discovery:** 1 pilot; 2 tail; 3 helicopter; 4 cockpit; 5 helipad; 6 blades; 7 sky; 8 passenger.

**Guided Practice:** 1 can; 2 has; 3 can; 4 can't; 5 has; 6 can; 7 has; 8 can.

**Listening:** 1 Pilot; 2 Two; 3 Blue; 4 On the hospital's helipad; 5 Yes.

**Homework:** 1 can; 2 has; 3 can't.
`;
const el=id=>document.getElementById(id);
el("lesson-level").textContent="CEFR A1";
el("lesson-duration").textContent="50 minutes";
el("lesson-date").textContent="Example template";
el("lesson-status").textContent="Example workbook · Original sample for demonstration";
for(const id of ["lesson-copy","lesson-download","lesson-print"])el(id).disabled=false;
renderWorkbook(el("lesson-content"),text);
el("lesson-print").addEventListener("click",()=>window.print());
el("lesson-copy").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(text);el("lesson-status").textContent="Example copied."}
 catch{el("lesson-status").textContent="Use Download instead."}
});
el("lesson-download").addEventListener("click",()=>{
 const url=URL.createObjectURL(new Blob([text],{type:"text/markdown;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="helloearth-example-helicopters.md";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
