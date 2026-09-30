# Manual kiosk test — physical device

This checklist is for the real portrait Android touchscreen running Chrome or a kiosk browser. The
automated suites (`npm run check`, `npx playwright test`) cover logic, accessibility rules (axe, WCAG 2.2
AA), layout at 1080 × 1920, rotation and budgets. This list covers what only real hardware can show.

Run it before each event, and after any change to the device, browser or network.

- **Setup:** run the production build on the laptop (`npm run build && npm run start:network`). Use the
  demo or production content mode that will run at the event.
- **Tester:** writes the date, device model, Android and browser versions, and initials at the bottom.
- **Results:** mark each item ✅ or ❌, with a short note for every ❌.
- **Test data:** use dummy contact data only (e.g. `prueba@example.com`), never a real visitor's.

## 1. Device and browser settings

- [ ] **Orientation:** screen locked to portrait in Android settings and in the kiosk browser.
- [ ] **Kiosk mode:** Chrome screen pinning or the kiosk browser's kiosk mode is on. The status and
      navigation bars are hidden, and the device cannot leave the app without the admin PIN.
- [ ] **Browser features:** autofill, password saving, translation prompts and "Tap to search" are off.
- [ ] **Zoom:** the browser's default page zoom (or text scaling) is 100 %.
  - The kiosk allows zoom for accessibility.
  - If the kiosk browser offers "disable pinch zoom" and the event team prefers it, record that decision
    here. The app no longer forces it (ADR-058).
- [ ] **Display:** the screen stays on (no sleep, no screensaver). Brightness is readable under the booth
      lighting.
- [ ] **Network:** the device reaches the laptop's address. The start URL is set and the page loads in
      under about 2 s.

## 2. Touch and gestures

- [ ] **Tap:** every button reacts on the first tap, with no 300 ms delay and no double-tap zoom.
- [ ] **Pinch on the scene:** in the hospital explorer, pinching with two fingers does not zoom or shift the
      illustration. Hotspots stay on their features.
- [ ] **Pinch elsewhere:** outside the scene, pinch zoom (if the browser allows it) returns to normal with a
      pinch out. The layout is not broken afterwards.
- [ ] **Long-press:** on buttons, cards and scene images, no context menu, text selection handles or image
      drag appears.
- [ ] **Long-press in fields:** in the contact form, the paste menu appears and pasting works.
- [ ] **Swipes:** the page does not pull-to-refresh or bounce. Swiping from the edges does not leave the
      kiosk.
- [ ] **Touch targets:** a quick tap with a fingertip hits each target reliably, including the language
      toggle, close buttons, hotspots and checkboxes.
- [ ] **Hover:** nothing needs hover. Hotspot labels appear on touch.

## 3. Rotation and resizing

- [ ] **Rotation mid-journey:** if the orientation lock is ever disabled, rotating the device mid-journey
      (explorer with an information sheet open, and again on the contact form with text typed) keeps the
      screen, the choices and the typed text. The scene re-fits without cropping hotspots.
- [ ] **On-screen keyboard:** opening it on the contact form does not hide the focused field or the
      "Continue" button. Closing it restores the layout.

## 4. Accessibility on the device

- [ ] **Accessibility sheet:** "Larger text" enlarges text without cutting it off. "Reduce motion"
      removes the scene zoom and pan animations.
- [ ] **System setting:** with Android "Remove animations" on, the scene changes instantly.
- [ ] **TalkBack:** turn it on and complete the start screen, a role choice and one hotspot sheet.
  - Headings, buttons and the sheet are announced in the current language.
  - Closing the sheet returns focus to the hotspot.
- [ ] **Keyboard:** with an external USB or Bluetooth keyboard, if one will be at the booth, Tab moves
      through controls with a visible focus ring. Enter activates them, and Escape closes sheets.
- [ ] **Contrast:** text and focus rings are readable under booth lighting, and from a wheelchair height.

## 5. Session, privacy and reset

- [ ] **Full visit:** attract → role → recommendations → contact → review → send.
  - The completion screen shows the masked email and a countdown.
  - It returns to the attract screen by itself.
- [ ] **Clean slate:** after the reset, Back or swipe-back does not show the previous visitor's screens or
      data, and the form fields are empty.
- [ ] **Inactivity:** leaving a journey untouched shows the warning. "Continue my session" keeps it;
      ignoring it resets to the attract screen.
- [ ] **Double tap on send:** tapping "Send" twice quickly stores one lead only. Check it in the admin
      utility on the laptop.
- [ ] **No admin link:** there is no link or gesture to the admin utility on any visitor screen.

## 6. Network and recovery

- [ ] **Wi-Fi drop:** turn Wi-Fi off on the device mid-journey. Navigation keeps working. Sending the form
      shows the "try again" message, and it succeeds once Wi-Fi is back.
- [ ] **Laptop restart:** restart the laptop server while the attract screen is showing. The kiosk
      recovers after reload, or by itself if the kiosk browser reloads on error.
- [ ] **Browser reload:** reloading mid-journey returns to a fresh attract screen, with no previous data.
- [ ] **Email:** with the preview provider, the report appears in the email preview folder on the laptop.
      With SMTP, the test address receives it.

## 7. Performance feel

- [ ] **First screen:** cold load to an interactive attract screen takes about 2 s or less on the booth
      network.
- [ ] **Scene changes:** the zoom and pan transitions are smooth, with no visible stutter or blank frames.
- [ ] **Contact form:** it opens instantly, with no loading spinner. It is prefetched in the background.
- [ ] **Endurance:** after 20 consecutive visits with resets, the device is not noticeably slower and the
      laptop shows no errors in the log.

## Result

| Date | Device / Android / browser | Tester | Result | Notes |
| ---- | -------------------------- | ------ | ------ | ----- |
|      |                            |        |        |       |
