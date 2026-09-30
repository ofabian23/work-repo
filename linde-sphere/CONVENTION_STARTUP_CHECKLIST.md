# Convention startup checklist

Use this at the start of each convention day, before visitors arrive. It takes about 15 minutes. Setup
details are in [README.md → Deployment on the event laptop](./README.md#deployment-on-the-event-laptop-windows).
For new hardware, run [MANUAL_KIOSK_TEST.md](./MANUAL_KIOSK_TEST.md) first.

Items marked **[Linde IT]** follow settings that Linde IT has approved. This checklist does not grant
permission to change power, hotspot, network, firewall or browser-lockdown settings. If an approved
setting is missing or does not work, stop and contact IT; do not change it yourself.

- Use test data only: an address such as `prueba@example.com`, or the team's approved test mailbox.
- Never use a real visitor's data.

| #   | Check                                                                                                                                                                               | Done |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | **Laptop power:** the charger is connected to mains power, the battery is charging, and the cable cannot be pulled by visitors.                                                     | ☐    |
| 2   | **Screen and sleep:** screen-off, sleep and lid-close behavior are set as Linde IT approved for event use. The laptop will not sleep while the kiosk runs. **[Linde IT]**           | ☐    |
| 3   | **Kiosk power and display:** the tablet is charging, its screen stays on, and it is locked to portrait as configured. **[Linde IT]**                                                | ☐    |
| 4   | **Network:** the laptop and the kiosk are on the same approved network (the approved Mobile Hotspot or the approved venue network). The kiosk shows it as connected. **[Linde IT]** | ☐    |
| 5   | **Server running:** `powershell -NoProfile -File scripts\windows\start-kiosk-server.ps1` shows `[ OK ]` for every check and `Health: ok`, and the window stays open.                | ☐    |
| 6   | **Kiosk URL loaded:** Chrome on the kiosk opens `http://<laptop-IPv4>:<port>/` (the address the script printed) and shows the attract screen in Spanish.                            | ☐    |
| 7   | **Health from the kiosk:** `http://<laptop-IPv4>:<port>/api/health` on the kiosk shows `"status":"ok"`.                                                                             | ☐    |
| 8   | **Test lead submitted:** complete a full visit on the kiosk with test data (role → recommendations → contact → review → send). The completion screen shows the masked email.        | ☐    |
| 9   | **Test email confirmed:** the test mailbox received the report. With the preview provider, the file is in the preview folder. `npm run email:status` shows no failures.             | ☐    |
| 10  | **Reset tested:** after the test visit, the kiosk returns to the attract screen (countdown or "Finalizar ahora"). Back or swipe-back shows no previous data.                        | ☐    |
| 11  | **Inactivity reset:** a visit left untouched shows the warning, then returns to the attract screen.                                                                                 | ☐    |
| 12  | **Lead database backed up:** run `npm run db:backup` and move the file only to approved encrypted storage. **[Linde IT] [Linde Privacy]**                                           | ☐    |
| 13  | **Admin utility:** off (`ADMIN_ENABLED=false`) unless someone needs it today. No admin link is visible on the kiosk.                                                                | ☐    |
| 14  | **Laptop custody:** the laptop screen is locked or supervised, and the laptop is out of visitors' reach. **[Linde IT]**                                                             | ☐    |

Keep test leads identifiable (e.g. `@example.com`). Delete or exclude them following the process agreed
with Linde Privacy; the MVP has no delete function.

## End of day

- [ ] Let the current visitor finish, then run `npm run db:backup`. Move the backup to approved encrypted
      storage.
- [ ] Press **Ctrl+C** in the server window. Wait for "The server stopped".
- [ ] Close the kiosk browser. Store or lock the tablet and laptop as IT requires.

## Sign-off

| Date | Event / booth | Checked by | Issues and who was contacted |
| ---- | ------------- | ---------- | ---------------------------- |
|      |               |            |                              |
