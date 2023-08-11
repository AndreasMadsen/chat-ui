import type { BackendModel } from "./server/models";
import type { Message } from "./types/Message";
import { collections } from "$lib/server/database";
import { ObjectId } from "mongodb";
/**
 * Convert [{user: "assistant", content: "hi"}, {user: "user", content: "hello"}] to:
 *
 * <|assistant|>hi<|endoftext|><|prompter|>hello<|endoftext|><|assistant|>
 */

export async function buildPrompt(
	messages: Pick<Message, "from" | "content">[],
	model: BackendModel,
	webSearchId?: string
): Promise<string> {
	let prompt =
		messages
			.map((m) => (
				m.from === "user" ? (
					model.userMessageToken +
					m.content +
					(m.content.endsWith(model.userMessageEndToken) ? "" : model.userMessageEndToken)
				) : (
					model.assistantMessageToken +
					m.content +
					(m.content.endsWith(model.assistantMessageEndToken) ? "" : model.assistantMessageEndToken)
				)
			))
			.join("") + model.assistantMessageToken;

	if (model.trimPrompt) {
		prompt = prompt.trimEnd();
	}

	let webPrompt = "";

	if (webSearchId) {
		const webSearch = await collections.webSearches.findOne({
			_id: new ObjectId(webSearchId),
		});

		if (!webSearch) throw new Error("Web search not found");

		if (webSearch.summary) {
			webPrompt =
				model.assistantMessageToken +
				`The following context was found while searching the internet: ${webSearch.summary}` +
				model.assistantMessageEndToken;
		}
	}
	const finalPrompt =
		model.preprompt +
		webPrompt +
		prompt
			.split(" ")
			.slice(-(model.parameters?.truncate ?? 0))
			.join(" ");

	// Not super precise, but it's truncated in the model's backend anyway
	return finalPrompt;
}
