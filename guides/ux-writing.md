## UX writing principles

These principles apply to every piece of interface text you write or review. The sources in `company/copy-sources.md` add the company's rules. Where they conflict with a principle here, the company rule applies.

### Write for the task

1. Write for the moment the user is in: what they see, what they just did, and what they want next. Read the state's trigger and condition in `states.md` before you write its text.
2. Name the task, and leave out the mechanics. "Change your primary email" names the task, and its verb points to the button with the same label. "Click Change next to the primary email" describes the mechanics.
3. Never write "click", "tap", "press", or "hit". When the task alone does not point to the control, name the control by its exact label, with "select" as the verb.
4. When a sentence states a goal and an action, put the goal first: "To get receipts at a new address, change your primary email." The reader finds the sentence by its goal.
5. One idea per sentence. Join two steps with "then" when the second step follows from the first in the same place.
6. Remove every word that adds nothing, such as "in order to", "currently", "simply", "successfully", and "note that".
7. Use the user's words. No internal term, error code, field name, or component name appears.

### Consistency

1. One concept has one term across the page and the flow. Reuse the term the product already uses.
2. A button and the title of the view it opens use the same verb: "Change email" opens "Change email".
3. Read each view as one text: heading, description, title, body, buttons, and links, in reading order. When a name shows in the heading and again in the title or a button, remove the repetition. The heading names the object, and the button pairs its verb with a generic noun, such as `Add email…` under the heading `Recovery email`. Where no heading names the object, such as in a modal, the button keeps the full name.
4. A name never contains the verb of a button beside it, such as "add" in "additional".
5. In a pair of names, each name states a role, such as `Primary email` and `Recovery email`. A name that states only an order, such as "additional" or "secondary", gives no reason to add the item.
6. A text that names a control quotes its current label. Labels change during a project. Before you write a reference, check the label in `states.md`, and look up later changes to the label in the decision log. When a label changes, search every text for the old label, as a noun and as a verb, and rewrite each sentence that names it. A label swapped into an old sentence keeps the faults of that sentence, such as "click".
7. The buttons of a confirmation repeat the verb of its title: "Remove this email?" has "Remove email" and "Cancel". Never use "Yes", "No", or "OK".

### What each element holds

| Element | Content |
|---|---|
| Title | What the view or the message is about, in a few words. |
| Body | Why it matters, or what happens next. It never repeats the title. |
| Button | A verb and an object, stating what happens when the user acts. |
| Error | What happened, why when known, and how to recover, in the product's error pattern. |
| Empty state | What appears here, and how to add the first item. |
| Helper text | What the user needs to complete the field, shown before an error occurs. |
| Toggle or checkbox | What turns on, stated in the positive. |
| Link | Its destination: "Learn how we calculate plan and usage charges", and never "Learn more" alone. |

### Tone

1. Calm and direct in every state, including errors.
2. Never blame the user. "The card was declined" states the event. "You entered an invalid card" blames the user.
3. Address the user as "you". The product never says "my".
4. Use plain words: "such as" in place of "e.g.", and "and" in place of "&".

### Accessibility

1. The text works without its position or its colour. Never write "the button on the right" or "the red message".
2. Each icon-only control has an accessible name that states its action.
3. Link text and button text make sense when read alone.

### Self-edit

Before you comment copy, check each text:

1. Read it as the user at the state's trigger. A knowledgeable colleague would say it at that moment.
2. It names the task. No "click" and no description of the screen remains.
3. Remove one word at a time. When the meaning stays, keep the removal.
4. Each control it names exists, with that exact label, in the current version.
5. Each term matches the rest of the flow.
6. It follows the product copy skill: sentence case, a verb first on each button, the error pattern, and the controlled vocabulary.

### Examples

| Before | After | Principle |
|---|---|---|
| To get receipts at a new address, click Change next to the primary email. Then enter the new address. | To get receipts at a new address, change your primary email, then enter the new address. | Name the task. When the button's label changes to "Update…", the text becomes "update your primary email". |
| Are you sure? [Yes] [No] | Remove this email? [Remove email] [Cancel] | The buttons repeat the verb of the title. |
| Click here to learn more. | Learn how we calculate your bill | The link names its destination. |
| Error: payment failed | Something went wrong charging your card. Your bank declined the payment. Try again or contact support. | The error pattern: the action, the reason, and the recovery. |
