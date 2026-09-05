// ============================================
//   EventHandler.ts
//   Maps server game events to local juice:
//   particles, screen shake, audio.
// ============================================

import { C, PLAYER_IDENTITY } from '@void-sector/shared';
import type { MsgEvent, EnemyDieData, PlayerEventData, PickupData } from '@void-sector/shared';
import * as Audio      from './fx/Audio.js';
import * as Particles  from './fx/Particles.js';

export function handleEvent(msg: MsgEvent, myId: number | null): void {
  const { event, x, y, data } = msg;

  switch (event) {
    case 'enemy_die': {
      const d = data as EnemyDieData;
      Particles.spawnExplosion(x, y, {
        color: d.enemyType ? C.ENEMY[d.enemyType].COLOR : C.COLOR.PRIMARY,
        count: d.enemyType === 'C' ? 18 : C.PARTICLE.EXPLOSION_COUNT,
      });
      Particles.shake(C.SHAKE.HIT_INTENSITY);
      Audio.play('enemyDie');
      if (d.playerId === myId) {
        const label = d.multiplier > 1 ? `+${d.score} x${d.multiplier}` : `+${d.score}`;
        Particles.spawnFloatText(x, y, label, {
          color: d.multiplier > 1 ? C.COLOR.ACCENT : C.COLOR.PRIMARY,
        });
      }
      break;
    }
    case 'enemy_hit': {
      const d = data as { enemyType?: string };
      Particles.spawnHitSpark(x, y, {
        color: d.enemyType ? (C.ENEMY[d.enemyType as keyof typeof C.ENEMY]?.COLOR ?? C.COLOR.PRIMARY) : C.COLOR.PRIMARY,
      });
      Audio.play('enemyHit');
      break;
    }
    case 'player_hit': {
      const d = data as PlayerEventData;
      if (d.playerId === myId) { Particles.flash(C.COLOR.DANGER, 0.35); Particles.shake(C.SHAKE.HIT_INTENSITY); }
      Particles.spawnExplosion(x, y, { color: C.COLOR.DANGER, count: 8 });
      Audio.play('playerHit');
      break;
    }
    case 'player_die': {
      const d  = data as PlayerEventData;
      const id = PLAYER_IDENTITY[d.playerId];
      Particles.spawnExplosion(x, y, { color: id?.color ?? C.COLOR.DANGER, count: C.PARTICLE.EXPLOSION_COUNT * 2, spread: 2.0 });
      Particles.shake(C.SHAKE.DEATH_INTENSITY);
      if (d.playerId === myId) Particles.flash(C.COLOR.DANGER, 0.8);
      Audio.play('playerDie');
      break;
    }
    case 'shield_hit':
      Particles.spawnExplosion(x, y, { color: C.COLOR.SHIELD, count: 6 });
      Particles.flash(C.COLOR.SHIELD, 0.25);
      Audio.play('shieldHit');
      break;
    case 'pickup': {
      const d = data as PickupData;
      Audio.play('pickup');
      if (d.playerId === myId) {
        const labels: Record<string, string> = {
          RAPID: 'RAPID FIRE!', SPREAD: 'SPREAD SHOT!', SHIELD: 'SHIELD UP!', BOMB: 'BOMB +1', LIFE: 'EXTRA LIFE!',
        };
        Particles.spawnFloatText(x, y - 2, labels[d.pickupType] ?? d.pickupType, { color: C.POWERUP.COLORS[d.pickupType] });
        if (d.pickupType === 'LIFE')   Particles.flash(C.COLOR.PRIMARY, 0.3);
        if (d.pickupType === 'SHIELD') Particles.flash(C.COLOR.SHIELD,  0.25);
      }
      break;
    }
    case 'bomb':
      Particles.flash(C.COLOR.WARN, 0.6);
      Particles.shake(C.SHAKE.DEATH_INTENSITY * 0.7);
      Audio.play('bomb');
      break;
    case 'wave_clear':
      Audio.play('waveClear');
      break;
  }
}
