## Visual design principles

These principles apply to every screen you design, build, or review. When a rule in `notes/design-system.md` conflicts with a principle here, the company rule applies.

### Gestalt principles

The eye groups elements before it reads them. Each grouping on the screen must match the meaning of the content.

| Principle | What the eye does | Apply as |
|---|---|---|
| Proximity | Groups elements that are close together. | The space inside a group is smaller than the space between groups. A heading is closer to its own content than to the content above it. A label is closer to its field than to the field before it. |
| Similarity | Groups elements that look alike in colour, size, shape, or weight. | Elements with one job look the same. An element that looks like another element has the same job. |
| Common region | Groups elements inside one boundary. | A card, a border, or a background groups its content. Add a boundary only when spacing cannot show the group. |
| Uniform connectedness | Groups elements joined by a line or a shared background. | A divider separates two groups. It never splits one group. |
| Continuity | Follows a line or a curve. | Elements on one axis read as one sequence. Align a sequence on one edge. |
| Closure | Completes a shape that is incomplete. | A card cut off at the edge of a scroll area shows that more content follows. |
| Figure and ground | Separates the foreground from the background. | A modal, a menu, or a popover sits clearly above the page, with an overlay, a shadow, or a contrast change. |
| Common fate | Groups elements that move or change together. | Elements that change state together belong to one group. |
| Prägnanz | Reads the simplest form available. | Use simple shapes, and as few boundaries, lines, and colours as the content needs. |
| Focal point | Notices the element that differs first. | Each view has one focal point: the primary action or the key information. |

### Alignment

1. Every element aligns with another element: an edge, a centre, or a text baseline.
2. Two edges either align exactly or differ by 8 px or more. An offset of 1 to 4 px reads as a mistake.
3. In a row, align text on its baseline. Centre an icon on the first line of its text, and not on the box of a wrapping paragraph. Centre a control, such as a button or an input, on the other controls in the row.
4. In a column, the elements share one left edge. Text under a row with an icon starts at the text of that row when it belongs to the text, and at the icon when it belongs to the whole row.
5. In a table, numbers align right, with tabular figures. Text aligns left.
6. Optical alignment can differ from geometric alignment. A round shape or a play icon can need a shift of 1 px to look aligned. Record each shift as a judgement call.
7. A container has the same padding on each side, unless its component sets different padding.

### Spacing

1. Use only the values on the spacing scale. `notes/design-system.md` lists them.
2. Space shows relationships. The space inside a component is smaller than the space between components, and that space is smaller than the space between sections.
3. One relationship uses one space throughout the view: every label to its field, every card to the next card.
4. Leave space empty where the grouping needs it. Add no element to fill space.

### Typography

1. Hierarchy uses size, weight, and colour. One component uses two or three levels at most.
2. A change of level is clear. Two text styles that differ by 1 px or by one weight step read as an error.
3. A line of body text holds 45 to 75 characters.
4. Text that wraps has a larger line height than single-line UI text.
5. Truncate text only where the full text is available another way, such as a tooltip. Check long text, short text, and a missing value.

### Colour and contrast

1. Use colour tokens only.
2. Text has a contrast of at least 4.5:1, and 3:1 at 18 px and larger or at 14 px bold. An icon or a control border that carries meaning has at least 3:1. These are the WCAG 2.2 AA levels.
3. Colour never carries meaning alone. Pair it with text or an icon.
4. Colour marks meaning: status, links, the primary action, and errors. The rest of the screen is neutral.

### Hierarchy and emphasis

1. Each view has one primary action. The other actions are secondary or tertiary.
   - Check each section, a heading with its content, and each page message. A section has one primary action, and a page message has one action.
   - The primary action is the action the user most likely needs in that section and state. In an empty section, the action that fills it is primary.
   - When sections of one kind show the same buttons, only the section that matters most in the state keeps the primary.
2. The order the eye reads the screen matches the order of the task. Blur the screenshot, or view it small: the elements still visible are the ones the design emphasises.
3. Emphasis is relative. When every element has emphasis, no element stands out.
4. A destructive action is never the most prominent action. It sits apart from the safe action.

### Consistency

1. One job uses one component, one position, and one word across the product.
2. Items of one kind shown together have the same layout, and the same actions in the same order.
3. Follow the product's patterns and common web conventions before you make a new pattern.

### States and interaction

1. Every interactive element has a visible hover, focus, active, and disabled state. Keyboard focus is always visible.
2. A control looks interactive. A button looks like a button, and a link looks like a link.
3. Each action gives feedback at the place the user acted: loading, success, or an error.
4. A click target is at least 24 by 24 px, and the main action is larger. This is WCAG 2.2 criterion 2.5.8.
5. Design for real content: empty, one item, many items, long text, and errors.
6. An empty state replaces the content of a filled state, so compare the two:
   - The left edge of the placeholder matches the left edge of the logo or avatar in the filled state.
   - The placeholder has the size and the shape of what it stands for.
   - The action sits where the actions sit in the filled state.
   - The text and the icon are centred on one line with the button.

### Ten principles for good design

Dieter Rams's ten principles test a whole design. Good design is innovative. It makes a product useful. It is aesthetic. It makes a product understandable. It is unobtrusive. It is honest. It is long-lasting. It is thorough down to the last detail. It is environmentally friendly. It is as little design as possible.

### Naming the principle

In each plan, each build comment, and each review finding, name the principle a layout decision applies, such as "Proximity: the heading has 32 px above it and 12 px below it". When a design breaks a principle on purpose, name the principle and give the reason.
