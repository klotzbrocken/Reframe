/*
 * Default prompt template for "Period Render". Shared so the Settings dialog can
 * show/edit it and the main process can fall back to it. Placeholders {year},
 * {title} and {text} are substituted before the request. The wording strongly
 * anchors the model on a *website rendered in a browser* (not a newspaper /
 * print layout — a common failure mode) while keeping the real content faithful.
 */
export const DEFAULT_PERIOD_PROMPT = `Recreate this as a WEBSITE exactly as it would have looked if it had been built and viewed in a web browser in {year}.

Output ONE screenshot of a web page on a computer screen. It must clearly look like a real website of that era — NOT a newspaper, magazine, poster, book or any kind of print layout.

Keep ALL real content faithfully: reproduce the exact text, headings, links, prices, numbers and names from the page below. Do not invent, translate, paraphrase, summarise or remove any information.

Restyle ONLY the visual design to match real {year} web design: the period-typical page layout and grid, colour palette, web-safe typography, navigation bars, buttons, form fields, banners and icons. Replace photos and graphics with {year}-appropriate web imagery. Use an era-appropriate page width and fill the whole frame edge to edge.

Page title: {title}

Visible text to preserve verbatim:
{text}`
