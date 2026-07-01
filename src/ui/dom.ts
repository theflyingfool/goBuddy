// Minimal DOM helpers — no framework per project decision. Keeps view code
// from turning into raw innerHTML string soup.

type Attrs = Record<string, string | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

export function clear(container: HTMLElement) {
  container.replaceChildren();
}

export function labeledToggle(
  label: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const input = el("input", { type: "checkbox" }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "toggle-row" }, [input, el("span", {}, [label])]);
}
