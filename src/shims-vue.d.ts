// tsc (via `npm run build`'s `tsc -b`) doesn't understand .vue files on its
// own — Vite's plugin handles the real transform, this just lets `.ts` files
// import a `.vue` component without a type error. Real template
// type-checking (vue-tsc) is out of scope for now, see docs/vue-migration-plan.md.
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
