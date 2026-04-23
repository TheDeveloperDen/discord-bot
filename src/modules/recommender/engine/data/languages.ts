import type { RecommendationTarget } from "../types.js";

export const languages: RecommendationTarget[] = [
	{
		id: "python",
		kind: "language",
		name: "Python",
		emoji: "🐍",
		description:
			"Versatile, beginner-friendly, dominant in AI and data science",
		pros: [
			"Very easy to learn",
			"Massive ecosystem and community",
			"Best language for AI/ML",
			"Huge job market",
		],
		cons: [
			"Slow runtime performance",
			"GIL limits true concurrency",
			"Dynamic typing can hide bugs",
		],
		tags: ["scripting", "ml", "web", "beginner", "mainstream"],
		learningResourceIds: ["python.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/python" },
			{ label: "Official Docs", url: "https://docs.python.org/3/" },
		],
	},
	{
		id: "javascript",
		kind: "language",
		name: "JavaScript",
		emoji: "🌐",
		description: "The language of the web — runs everywhere",
		pros: [
			"Runs in every browser",
			"Enormous ecosystem (npm)",
			"Full-stack with Node.js",
			"Very large job market",
		],
		cons: [
			"Quirky type coercion",
			"No built-in type safety",
			"Callback/async complexity",
		],
		tags: ["web", "scripting", "fullstack", "beginner", "mainstream"],
		learningResourceIds: ["javascript.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/javascript" },
			{
				label: "MDN Docs",
				url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
			},
		],
	},
	{
		id: "typescript",
		kind: "language",
		name: "TypeScript",
		emoji: "🔷",
		description: "JavaScript with static types — safer and more scalable",
		pros: [
			"Catches bugs at compile time",
			"Excellent IDE support",
			"Scales to large codebases",
			"Growing job demand",
		],
		cons: [
			"Extra compilation step",
			"Complex type system to master",
			"Still inherits JS quirks",
		],
		tags: ["web", "fullstack", "typed", "mainstream"],
		learningResourceIds: ["typescript.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/typescript" },
			{
				label: "Official Handbook",
				url: "https://www.typescriptlang.org/docs/handbook/",
			},
		],
	},
	{
		id: "java",
		kind: "language",
		name: "Java",
		emoji: "☕",
		description: "Enterprise workhorse — write once, run anywhere",
		pros: [
			"Enormous job market",
			"Extremely mature ecosystem",
			"Strong typing and OOP",
			"Minecraft modding & Android",
		],
		cons: ["Verbose syntax", "Slow startup times", "Heavy boilerplate"],
		tags: ["enterprise", "android", "plugins", "mainstream"],
		learningResourceIds: ["java.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/java" },
			{ label: "Dev.java", url: "https://dev.java/learn/" },
		],
	},
	{
		id: "kotlin",
		kind: "language",
		name: "Kotlin",
		emoji: "🟣",
		description: "Modern, concise JVM language — official for Android",
		pros: [
			"Much less boilerplate than Java",
			"Null safety built in",
			"Official Android language",
			"Full Java interop",
		],
		cons: [
			"Smaller community than Java",
			"Slower compilation",
			"Less standalone job demand",
		],
		tags: ["android", "plugins", "jvm", "modern"],
		learningResourceIds: ["kotlin.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/android" },
			{
				label: "Kotlin Docs",
				url: "https://kotlinlang.org/docs/getting-started.html",
			},
		],
	},
	{
		id: "c",
		kind: "language",
		name: "C",
		emoji: "⚙️",
		description: "The foundation — learn how computers actually work",
		pros: [
			"Teaches memory management",
			"Maximum performance",
			"Basis of most operating systems",
			"Tiny runtime footprint",
		],
		cons: [
			"Manual memory management",
			"Easy to create security bugs",
			"No built-in data structures",
		],
		tags: ["systems", "performance", "low-level", "educational"],
		learningResourceIds: ["c.yaml"],
		resources: [
			{
				label: "Learn C",
				url: "https://www.learn-c.org/",
			},
		],
	},
	{
		id: "cpp",
		kind: "language",
		name: "C++",
		emoji: "🎮",
		description: "High-performance systems language — games, engines, and more",
		pros: [
			"Top performance with abstractions",
			"Game industry standard",
			"Huge ecosystem",
			"Unreal Engine language",
		],
		cons: [
			"Very complex language",
			"Long compile times",
			"Easy to shoot yourself in the foot",
		],
		tags: ["systems", "games", "performance", "mainstream"],
		learningResourceIds: ["cpp.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/cpp" },
			{ label: "Learn C++", url: "https://www.learncpp.com/" },
		],
	},
	{
		id: "csharp",
		kind: "language",
		name: "C#",
		emoji: "💜",
		description: "Versatile language for games (Unity), web, and enterprise",
		pros: [
			"Unity game engine language",
			"Excellent tooling (Visual Studio)",
			"Strong .NET ecosystem",
			"Good job market",
		],
		cons: ["Historically Windows-centric", "Large runtime", "Can feel verbose"],
		tags: ["games", "enterprise", "web", "mainstream"],
		learningResourceIds: ["csharp.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/aspnet-core" },
			{
				label: "Microsoft Learn",
				url: "https://learn.microsoft.com/en-us/dotnet/csharp/",
			},
		],
	},
	{
		id: "rust",
		kind: "language",
		name: "Rust",
		emoji: "🦀",
		description:
			"Safe, fast, and modern systems programming — no garbage collector",
		pros: [
			"Memory safety without GC",
			"Excellent performance",
			"Amazing compiler error messages",
			"Rapidly growing ecosystem",
		],
		cons: [
			"Steep learning curve",
			"Borrow checker can be frustrating",
			"Longer development time",
		],
		tags: ["systems", "performance", "safe", "niche", "modern"],
		learningResourceIds: ["rust.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/rust" },
			{
				label: "The Rust Book",
				url: "https://doc.rust-lang.org/book/",
			},
		],
	},
	{
		id: "go",
		kind: "language",
		name: "Go",
		emoji: "🐹",
		description:
			"Simple, fast, and built for concurrency — great for backends and DevOps",
		pros: [
			"Very easy to learn",
			"Excellent concurrency (goroutines)",
			"Fast compilation",
			"Strong DevOps/cloud ecosystem",
		],
		cons: [
			"Limited generics (improving)",
			"Verbose error handling",
			"No exceptions or sum types",
		],
		tags: ["backend", "devops", "cloud", "modern"],
		learningResourceIds: ["go.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/golang" },
			{
				label: "Go Tour",
				url: "https://go.dev/tour/welcome/1",
			},
		],
	},
	{
		id: "zig",
		kind: "language",
		name: "Zig",
		emoji: "⚡",
		description:
			"Modern low-level language — a better C with no hidden control flow",
		pros: [
			"Simpler than C/C++/Rust",
			"No hidden allocations",
			"Great C interop",
			"Comptime metaprogramming",
		],
		cons: ["Still pre-1.0", "Small ecosystem", "Limited learning resources"],
		tags: ["systems", "performance", "low-level", "niche", "modern"],
		resources: [
			{ label: "Zig Guide", url: "https://zig.guide/" },
			{ label: "Ziglearn", url: "https://ziglearn.org/" },
		],
	},
	{
		id: "haskell",
		kind: "language",
		name: "Haskell",
		emoji: "λ",
		description: "Pure functional programming — expand your mind",
		pros: [
			"Powerful type system",
			"Immutability by default",
			"Teaches functional thinking",
			"Great for compilers/DSLs",
		],
		cons: [
			"Very steep learning curve",
			"Small job market",
			"Lazy evaluation can be confusing",
		],
		tags: ["functional", "academic", "niche"],
		resources: [
			{
				label: "Learn You a Haskell",
				url: "https://learnyouahaskell.com/",
			},
		],
	},
	{
		id: "elixir",
		kind: "language",
		name: "Elixir",
		emoji: "💧",
		description:
			"Functional language for scalable, fault-tolerant systems on the BEAM",
		pros: [
			"Amazing concurrency model",
			"Fault tolerance built in",
			"Great for real-time apps",
			"Phoenix framework is excellent",
		],
		cons: [
			"Small ecosystem",
			"Niche job market",
			"Functional paradigm shift needed",
		],
		tags: ["functional", "backend", "concurrent", "niche"],
		resources: [
			{ label: "Elixir School", url: "https://elixirschool.com/" },
			{
				label: "Official Guide",
				url: "https://elixir-lang.org/getting-started/introduction.html",
			},
		],
	},
	{
		id: "ruby",
		kind: "language",
		name: "Ruby",
		emoji: "💎",
		description:
			"Elegant, developer-friendly language — optimized for happiness",
		pros: [
			"Beautiful, readable syntax",
			"Rails is great for web apps",
			"Strong testing culture",
			"Quick prototyping",
		],
		cons: [
			"Slow performance",
			"Declining job market",
			"Less relevant outside web",
		],
		tags: ["web", "scripting", "beginner", "niche"],
		resources: [
			{
				label: "Ruby Guide",
				url: "https://www.ruby-lang.org/en/documentation/quickstart/",
			},
			{ label: "Rails Tutorial", url: "https://www.railstutorial.org/" },
		],
	},
	{
		id: "swift",
		kind: "language",
		name: "Swift",
		emoji: "🍎",
		description: "Apple's modern language for iOS, macOS, and beyond",
		pros: [
			"Required for iOS development",
			"Safe and modern syntax",
			"Strong Apple ecosystem",
			"Good performance",
		],
		cons: [
			"Mostly Apple-only ecosystem",
			"Frequent language changes",
			"Limited server-side adoption",
		],
		tags: ["mobile", "apple", "modern"],
		learningResourceIds: ["swift.yaml"],
		resources: [
			{ label: "Roadmap", url: "https://roadmap.sh/ios" },
			{
				label: "Swift.org",
				url: "https://www.swift.org/getting-started/",
			},
		],
	},
	{
		id: "lua",
		kind: "language",
		name: "Lua",
		emoji: "🌙",
		description:
			"Tiny, embeddable scripting language — huge in games and modding",
		pros: [
			"Extremely simple to learn",
			"Tiny footprint",
			"Used in Roblox, WoW, Neovim",
			"Great for game scripting",
		],
		cons: [
			"1-indexed arrays",
			"Small standard library",
			"Not much use outside embedding",
		],
		tags: ["scripting", "games", "embedded", "niche", "beginner"],
		resources: [
			{
				label: "Programming in Lua",
				url: "https://www.lua.org/pil/contents.html",
			},
		],
	},
];
