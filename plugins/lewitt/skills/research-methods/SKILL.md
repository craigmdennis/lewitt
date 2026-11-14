---
name: research-methods
description: How the researcher plans a study, defines what it measures, checks its data for bias and ambiguity, and presents findings so the design lead can make a decision. Use for every research task, whether desk research, product analytics, business data or competitor patterns.
---

# Research methods

## 1. Start from the decision

Before reading any data, write down:

1. The decision the research informs, and the options the designer is choosing between.
2. The result that would favour each option. If no result would change the choice, say so and stop.
3. The question in one sentence, with the population, the measure and the time window.

## 2. Define each measure

- **Name the unit,** such as an account, a workspace or a user. "Customer" and "active" have several meanings, so give the definition used.
- **Check each event and table before using it.** In Amplitude, list the project's events and properties first and use only names that exist. In a data warehouse, check `information_schema` and apply the data caveats in `notes/research.md`.
- **State the denominator.** A count without its base cannot be compared. Give both, such as "212 of 4,180 accounts (5.1%)".
- **Fix the time window and the time zone**, and say whether the window includes the current, incomplete period.
- **Remove what is not a real customer:** internal accounts, test accounts, trials when the question is about paying customers, and churned accounts when the question is about current behaviour.
- **Name a proxy as a proxy.** When the measure stands in for what the decision needs, say what it stands in for and how they could differ.

## 3. Check for bias

Run each check and record the result in the reply.

| Check | Question |
|---|---|
| Selection | Who is missing from the data, and would they answer differently? |
| Survivorship | Does the data hold only those who stayed, finished or succeeded? |
| Confirmation | What result would disprove the expected answer? Look for it. |
| Segments | Does the result hold for each large segment, such as plan, size and region? A total can reverse inside segments. |
| Sample size | How many records support the finding? Below about 30 per group, report the counts and no percentages. |
| Time | Do seasonality, a launch, an outage or a pricing change explain the result? |
| Cause | Does the data show that one thing causes another, or only that they occur together? Write only what it shows. |
| Patterns from other products | A pattern in Mobbin or on a competitor's site shows what they shipped. It does not show that it works. |

## 4. Rate confidence

- **High:** two or more independent sources agree, the measure is direct, and the sample is large.
- **Medium:** one good source, or a proxy measure, or a small sample.
- **Low:** one weak source, an untested assumption, or sources that disagree.

## 5. Present findings

Use the `dataviz` skill for every chart.

- **The answer comes first,** in one or two sentences that address the decision in section 1.
- **One chart answers one question.** Its title states the finding, such as "Most failed payments are retried within a day". Label units, show the count, and mark incomplete periods.
- **Choose the chart from the question:** compare groups with a bar chart, show change over time with a line chart, and show a spread with a histogram. Use a table when the reader needs exact values.
- **A dashboard serves one decision.** The top row holds the numbers that answer it, and the charts below explain them. Keep only the filters the decision needs.
- **Give every number its source and its query,** so a reader can reproduce it.

## Reply format

1. **Answer:** one or two sentences.
2. **Findings:**

   | Finding | Evidence | Source | Sample and window | Confidence |
   |---|---|---|---|---|

3. **What would change this:** the result or source that would reverse each finding rated High.
4. **Bias checks:** one line for each check in section 3.
5. **Open questions:** each question the research could not answer, and the source that could.
