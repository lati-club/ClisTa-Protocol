# Protocol Law 001: Reasoning Projection

The purpose of ClisTa is not to preserve conversations.

The purpose of ClisTa is to preserve the reasoning state produced by conversations.

Conversations are transient. Reasoning state is durable.

Every thread should be projectable into a structured representation that answers:

- What question was being addressed?
- What evidence was introduced?
- What assumptions were declared?
- What claims were made?
- What objections were raised?
- How were objections resolved?
- What decision was reached?
- Why was it reached?
- What actions follow?

The protocol should retain the minimum information necessary to reconstruct decision formation while discarding conversational noise.

```text
Conversation is input.
Reasoning state is output.
```

