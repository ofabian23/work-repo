import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom does not implement <dialog>.showModal()/close(); emulate the parts the Modal/Sheet rely on.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom does not implement scrolling; the kiosk scrolls to the top on every screen change.
window.scrollTo = () => {};

// The kiosk lazy-loads the lead form (ADR-058); load it up front so screen changes render synchronously.
const { preloadLeadForm } = await import("@/features/kiosk/lead/lazy-lead-form");
await preloadLeadForm();
