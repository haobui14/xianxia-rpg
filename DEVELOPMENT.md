# Development Notes

## Architecture Decisions

### Why Server Authority?

AI can hallucinate items, stats, and events. By making the server the source of truth, we ensure:
- Game balance is maintained
- No infinite gold/items exploits
- Reproducible gameplay
- Easier testing and debugging

### Why Deterministic RNG?

Using seedrandom with `world_seed + turn_number` provides:
- Reproducible encounters for testing
- Fair gameplay (no true randomness exploitation)
- Ability to replay and debug specific scenarios
- Predictable loot for balance tuning

### Why Structured AI Output?

JSON schema validation ensures:
- AI can't break the game with malformed responses
- Easy to extend with new fields
- Type-safe TypeScript integration
- Fallback responses when AI fails

## Game Balance Considerations

### Cultivation Speed

MVP targets ~30-50 turns to reach Qi Condensation stage 5:
- Breakthrough to stage 1: 100 exp (2-3 cultivation sessions)
- Each subsequent stage: (stage * 200) exp
- Spirit root grade provides multipliers

### Combat Difficulty

Formula: `damage = max(1, atk - def) * critical * variance`
- Early game: bandits have ~20 HP, 8-12 ATK
- Player starts with 100 HP, ~5 STR
- Qi attacks cost 10 qi but deal 2x damage

### Economy

- Starting silver: 100
- Herb gathering: 5-20 silver
- Bandit loot: 20-50 silver
- Spirit stones are rare (5-30% drop chance)

## Known Limitations (MVP)

1. **No Persistent User Auth**: Uses anonymous IDs
2. **Limited Realms**: Only Mortal and Qi Condensation (5 stages)
3. **Simple Combat**: No formations, techniques, or complex skills
4. **No Multiplayer**: Single-player only
5. **Basic Memory**: Simple summary system, not true conversation memory

## Future Enhancements

### Short Term

- [ ] Add more scene templates (15-20 total)
- [ ] Implement sect system
- [ ] Add cultivation techniques/manuals
- [ ] Create quest system
- [ ] Add NPC relationships

### Medium Term

- [ ] Extend to Foundation Establishment realm
- [ ] Add tribulation system
- [ ] Implement pill alchemy
- [ ] Add formation arrays
- [ ] Create world map with regions

### Long Term

- [ ] Multiplayer interactions
- [ ] Player market/trading
- [ ] Guild/sect management
- [ ] Custom technique creation
- [ ] Image generation for scenes

## Testing Strategy

### Manual Testing

1. Create character with different spirit roots
2. Test all scene templates trigger correctly
3. Verify breakthrough mechanics work
4. Check loot generation is fair
5. Ensure no stat overflow/underflow

### Automated Testing (TODO)

- Unit tests for game mechanics
- Integration tests for API routes
- E2E tests for complete game flow
- Performance tests for AI generation

## Performance Benchmarks

Target metrics:
- Character creation: < 2s
- Turn processing (with AI): 3-10s
- Turn processing (without AI/cached): < 500ms
- Database queries: < 100ms

Current bottlenecks:
- AI generation time (2-8s depending on model)
- Parsing and validating AI JSON

## Code Style Guidelines

- **Functions**: Use descriptive names, single responsibility
- **Types**: Explicit TypeScript types everywhere
- **Comments**: Explain "why", not "what"
- **File organization**: Group by feature, not by type
- **Error handling**: Always catch and log errors

## Deployment Checklist

- [ ] Test all environment variables are set
- [ ] Run database migrations
- [ ] Test with production AI API
- [ ] Enable error monitoring
- [ ] Set up analytics
- [ ] Test on mobile devices
- [ ] Verify CORS settings
- [ ] Check rate limiting

## Cost Estimation (per 1000 users/month)

Assuming average player does 100 turns:

- **Supabase Free Tier**: Up to 500MB database, 2GB bandwidth
- **OpenAI (GPT-4)**: ~100k turns × $0.01/turn = $1,000/month
- **OpenAI (GPT-3.5)**: ~100k turns × $0.002/turn = $200/month
- **Vercel Hobby**: Free for non-commercial

**Recommendation**: Start with GPT-3.5-turbo for cost efficiency.

## Localization Notes

### Vietnamese (vi)

- Primary language
- Use formal tu tiên terminology
- Keep xianxia terms in original (e.g., Luyện Khí)

### English (en)

- Translation provided for accessibility
- Mix of translated terms and romanized Chinese
- Example: "Luyện Khí (Qi Condensation)"

## Contributing

If expanding this project:

1. Follow existing patterns
2. Add types for new features
3. Update this document with decisions
4. Test with both locales
5. Keep server authority principle

---

**Last Updated**: 2026-01-15
