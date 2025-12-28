import type Module from "../module.js";
import { MemberJoinListener } from "./listeners/memberJoin.listener.js";
import { MessageAnalysisListener } from "./listeners/messageAnalysis.listener.js";

export const ThreatDetectionModule: Module = {
	name: "threatDetection",
	commands: [],
	listeners: [MessageAnalysisListener, MemberJoinListener],
};
