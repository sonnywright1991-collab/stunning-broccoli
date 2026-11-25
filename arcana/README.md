# Arcana

An occult companion as an installable mobile PWA. No build step, no dependencies, works offline.

- **Today**: deterministic card of the day (22 major arcana, same card all day), moon phase and illumination, planetary day and hour.
- **Sigil**: Spare-style sigil from an intent (vowels and repeated letters struck, remainder plotted on a ring).
- **Grimoire**: journal saved in the browser (localStorage); entries are stamped with the moon phase.

```bash
cd arcana && python3 -m http.server 8000   # open http://localhost:8000, then "Add to Home Screen"
node test.js                                # logic tests
```

Notes: planetary hours are fixed 60-minute blocks from 06:00 (not sunrise-based). Moon phase is computed from the mean synodic month, accurate to about a day.
