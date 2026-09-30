# Sales validation guide — Puerto Rico

This guide is for the Linde Puerto Rico sales team reviewing the content of Linde Sphere, the kiosk for
the healthcare convention.

Today every role, customer problem, solution and resource in the kiosk is a **demonstrative assumption**
written by the project team. Your answers decide what visitors may see.

- **Production mode** shows **only** items you have approved and the project team has marked validated.
- **Demo mode** (rehearsals and internal previews) may still show the rest, clearly marked "pending local
  validation".

Nothing is published until you approve it.

## 1. What you receive

Get the worksheet from the project team in one of two ways:

- **CSV file:** `exports/sales-validation.csv` (opens in Excel), one row per item.
- **Local admin page:** "Validación de ventas" in the kiosk laptop's admin utility, with filters by type
  and approval status and a confirmed download of the same CSV.

It covers four kinds of item:

| Type (`record_type`) | What it is in the kiosk                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `persona`            | A customer role the visitor can pick ("Trabajo en…"), e.g. procurement, clinical leadership           |
| `challenge`          | A customer problem the visitor can pick ("Necesito…"), e.g. supply continuity                         |
| `solution`           | A Linde capability the kiosk may recommend                                                            |
| `digital-asset`      | A brochure, image, video, technical sheet or web page linked from a solution and sent after the visit |

The worksheet contains **no visitor data**. It is internal to Linde: do not forward it outside the
company.

## 2. The ten questions

Answer these for each row, in the columns shown. If a question does not apply to an item type, leave it
as is.

| #   | Question                                                         | Where to answer                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Does Puerto Rico offer this?**                                 | `available_in_puerto_rico`: `yes`, `no` or `unknown`. For roles and problems: do we meet this customer role or problem in Puerto Rico?                                                                                                                                        |
| 2   | **What is the correct local name?**                              | `spanish_name` and `english_name`. Change them if the local name differs, and set `decision` to `rename`. Otherwise use `keep`, or `remove` if the item should not appear at all.                                                                                             |
| 3   | **Which customer roles buy or influence it?**                    | `intended_personas`: correct the list of roles (solutions and assets). The list shows which roles make the kiosk recommend this item today.                                                                                                                                   |
| 4   | **Which customer problems cause the conversation?**              | `intended_challenges`: correct the list of problems (solutions, assets and roles).                                                                                                                                                                                            |
| 5   | **In which care settings is it relevant?**                       | `intended_healthcare_areas`: hospital areas (ICU, operating room, laboratory, emergency, gas plant…) and care settings (acute hospital, ambulatory, home care…).                                                                                                              |
| 6   | **Which claims are approved?**                                   | `current_description` is exactly what visitors read. Write any change in `required_correction`. **Only approve wording you can stand behind:** no unapproved claims about performance, savings, compliance or local availability.                                             |
| 7   | **Which brochure, image, video or technical sheet is approved?** | `missing_digital_material`: name the approved material, where to find it, and its language (ES/EN), or say what is missing. Only publicly shareable, approved material can be linked.                                                                                         |
| 8   | **What should a visitor receive after the convention?**          | For solutions, `current_description` ends with the **next step** the emailed report promises the visitor. Correct it in `required_correction` (e.g. "send technical sheet X, then a call from the regional specialist"), and name the document in `missing_digital_material`. |
| 9   | **Which opportunities are highest priority?**                    | `recommendation_priority`: write `high`, `medium` or `low`. The kiosk ranks recommendations with it. The column shows "(proposed)" until you confirm it.                                                                                                                      |
| 10  | **Who receives the lead internally?**                            | `sales_owner`: the person or role accountable for this item, and who should receive leads interested in it. Use a role or a Linde work name only, never a customer.                                                                                                           |

Finally, set `approval_status`:

| Value               | Meaning                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `not-started`       | Not reviewed yet                                                         |
| `in-review`         | Being reviewed                                                           |
| `changes-requested` | Needs the corrections in `required_correction` before it can be approved |
| `approved`          | Correct as written: may be shown in production                           |
| `rejected`          | Must not be used; set `decision` to `remove`                             |

The other columns (`record_type`, `id`, `current_name`, `market_status`, `validation_status`) are for
reference. Do not change them: the project team uses `id` to apply your answers.

The persona, challenge and area lists (questions 3–5) are derived from how the kiosk links items and
from its recommendation rules. Edit the lists freely; the project team turns your corrections into rule
and link changes, and the next export shows the result.

## 3. Rules the system enforces

Approval only works when the answers are complete. The project team's checks refuse, for example:

- **Incomplete approval:** `approved` with no decision, no `sales_owner`, `unknown` availability, or an
  open `required_correction`. Corrections are applied first, then approved.
- **Offerings not available:** a solution or asset approved for production without `yes` for Puerto Rico.
- **Leftovers:** an item marked `no` or `remove` that has not been taken out of the kiosk. The system sets
  it to "unavailable" and never shows it.
- **Stale names:** a renamed item that is approved while still showing the old name.
- **Content without approval:** anything shown in production that is not approved.

## 4. How approval reaches the kiosk

1. **Review:** sales fills in the worksheet and returns it to the project team (or discusses it with them).
2. **Record:** the project team records the answers in the content files (each item's `salesReview`),
   applies renames and corrections, and marks approved items `validated` with the reviewer and date.
3. **Check:** `npm run content:check` validates everything against the rules above, and
   `npm run content:check -- --mode production` lists what is still missing before production mode can
   work.
4. **Confirm:** the updated worksheet and the admin page show which items are **ready for production**.
5. **Switch:** the event laptop runs with `CONTENT_MODE=production` only after sign-off. In production the
   kiosk shows only validated, approved items.
   - Paths with no approved content are hidden.
   - If nothing is approved yet, visitors see a neutral "we are preparing this experience" message.

Before production, the consent text and the report wording also need validation, by Linde Legal and
Marketing. Until then the kiosk collects no contact details in production mode. See PRIVACY_REVIEW.md,
items A1 and A11.

## 5. Tips for a fast review

- **Start with priorities:** on the admin page, filter by type `solution` and fix the priorities first
  (question 9). They drive what visitors see.
- **Remove freely:** one `remove` is better than a vague approval, and the kiosk works with fewer items.
- **Unknown availability:** if you do not know whether Puerto Rico offers something, use `unknown` and
  name who can confirm it in `required_correction`.
- **No customer data:** do not add customer names, prices or confidential terms to the worksheet.
