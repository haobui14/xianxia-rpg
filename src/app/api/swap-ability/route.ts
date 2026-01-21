import { NextResponse } from 'next/server';
import { runQueries } from '@/lib/database/queries';
import { GameState, CultivationTechnique, Skill } from '@/types/game';

// Limits for techniques and skills
const MAX_TECHNIQUES = 5;
const MAX_SKILLS = 6;
const MAX_PER_TYPE_TECHNIQUE = 2;
const MAX_PER_TYPE_SKILL = 2;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { runId, abilityType, activeId, queueId, action } = body;

    if (!runId || !abilityType || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load run
    const run = await runQueries.getById(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const state: GameState = run.current_state as GameState;

    // Initialize queues if they don't exist
    if (!state.technique_queue) state.technique_queue = [];
    if (!state.skill_queue) state.skill_queue = [];

    if (abilityType === 'technique') {
      if (action === 'forget' && activeId) {
        // Remove technique from active list
        const index = state.techniques.findIndex(t => t.id === activeId);
        if (index >= 0) {
          state.techniques.splice(index, 1);
        }
      } else if (action === 'learn' && queueId) {
        // Move technique from queue to active
        const queueIndex = state.technique_queue.findIndex(t => t.id === queueId);
        if (queueIndex < 0) {
          return NextResponse.json({ error: 'Technique not found in queue' }, { status: 400 });
        }
        
        const technique = state.technique_queue[queueIndex];
        const countByType = state.techniques.filter(t => t.type === technique.type).length;
        
        // Check limits
        if (state.techniques.length >= MAX_TECHNIQUES) {
          return NextResponse.json({ error: 'Active techniques full. Forget one first.' }, { status: 400 });
        }
        if (countByType >= MAX_PER_TYPE_TECHNIQUE) {
          return NextResponse.json({ error: `Already have ${MAX_PER_TYPE_TECHNIQUE} ${technique.type} techniques. Forget one first.` }, { status: 400 });
        }
        
        // Move from queue to active
        state.technique_queue.splice(queueIndex, 1);
        state.techniques.push(technique);
      } else if (action === 'swap' && activeId && queueId) {
        // Swap active technique with one from queue
        const activeIndex = state.techniques.findIndex(t => t.id === activeId);
        const queueIndex = state.technique_queue.findIndex(t => t.id === queueId);
        
        if (activeIndex < 0 || queueIndex < 0) {
          return NextResponse.json({ error: 'Technique not found' }, { status: 400 });
        }
        
        const activeTech = state.techniques[activeIndex];
        const queueTech = state.technique_queue[queueIndex];
        
        // Check if swap is valid (type limits)
        if (activeTech.type !== queueTech.type) {
          const countByNewType = state.techniques.filter(t => t.type === queueTech.type && t.id !== activeId).length;
          if (countByNewType >= MAX_PER_TYPE_TECHNIQUE) {
            return NextResponse.json({ error: `Already have ${MAX_PER_TYPE_TECHNIQUE} ${queueTech.type} techniques.` }, { status: 400 });
          }
        }
        
        // Perform swap
        state.techniques[activeIndex] = queueTech;
        state.technique_queue[queueIndex] = activeTech;
      } else if (action === 'discard' && queueId) {
        // Remove technique from queue permanently
        const queueIndex = state.technique_queue.findIndex(t => t.id === queueId);
        if (queueIndex >= 0) {
          state.technique_queue.splice(queueIndex, 1);
        }
      }
    } else if (abilityType === 'skill') {
      if (action === 'forget' && activeId) {
        // Remove skill from active list
        const index = state.skills.findIndex(s => s.id === activeId);
        if (index >= 0) {
          state.skills.splice(index, 1);
        }
      } else if (action === 'learn' && queueId) {
        // Move skill from queue to active
        const queueIndex = state.skill_queue.findIndex(s => s.id === queueId);
        if (queueIndex < 0) {
          return NextResponse.json({ error: 'Skill not found in queue' }, { status: 400 });
        }
        
        const skill = state.skill_queue[queueIndex];
        const countByType = state.skills.filter(s => s.type === skill.type).length;
        
        // Check limits
        if (state.skills.length >= MAX_SKILLS) {
          return NextResponse.json({ error: 'Active skills full. Forget one first.' }, { status: 400 });
        }
        if (countByType >= MAX_PER_TYPE_SKILL) {
          return NextResponse.json({ error: `Already have ${MAX_PER_TYPE_SKILL} ${skill.type} skills. Forget one first.` }, { status: 400 });
        }
        
        // Move from queue to active
        state.skill_queue.splice(queueIndex, 1);
        state.skills.push(skill);
      } else if (action === 'swap' && activeId && queueId) {
        // Swap active skill with one from queue
        const activeIndex = state.skills.findIndex(s => s.id === activeId);
        const queueIndex = state.skill_queue.findIndex(s => s.id === queueId);
        
        if (activeIndex < 0 || queueIndex < 0) {
          return NextResponse.json({ error: 'Skill not found' }, { status: 400 });
        }
        
        const activeSkill = state.skills[activeIndex];
        const queueSkill = state.skill_queue[queueIndex];
        
        // Check if swap is valid (type limits)
        if (activeSkill.type !== queueSkill.type) {
          const countByNewType = state.skills.filter(s => s.type === queueSkill.type && s.id !== activeId).length;
          if (countByNewType >= MAX_PER_TYPE_SKILL) {
            return NextResponse.json({ error: `Already have ${MAX_PER_TYPE_SKILL} ${queueSkill.type} skills.` }, { status: 400 });
          }
        }
        
        // Perform swap
        state.skills[activeIndex] = queueSkill;
        state.skill_queue[queueIndex] = activeSkill;
      } else if (action === 'discard' && queueId) {
        // Remove skill from queue permanently
        const queueIndex = state.skill_queue.findIndex(s => s.id === queueId);
        if (queueIndex >= 0) {
          state.skill_queue.splice(queueIndex, 1);
        }
      }
    }

    // Save updated state
    await runQueries.update(runId, state);

    return NextResponse.json({ state });
  } catch (error) {
    console.error('Error swapping ability:', error);
    return NextResponse.json(
      { error: 'Failed to swap ability' },
      { status: 500 }
    );
  }
}
