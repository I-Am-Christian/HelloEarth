import {mountLeaderboard} from "./leaderboard-core.js";
const root=document.getElementById("leaderboard-public");
const leaderboard=mountLeaderboard(root);
leaderboard.load();
