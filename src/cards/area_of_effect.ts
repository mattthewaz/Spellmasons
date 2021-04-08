import type { Spell } from '.';

const spell: Spell = {
  card: {
    id: 'area_of_effect',
    thumbnail: 'images/spell/aoe.png',
    onlyChangesTarget: true,
    probability: 10,
    effect: (state) => {
      let updatedTargets = [...state.targets];
      for (let target of state.targets) {
        const withinRadius = window.game.getCoordsWithinDistanceOfTarget(
          target.x,
          target.y,
          1,
        );
        updatedTargets = updatedTargets.concat(withinRadius);
      }
      // deduplicate
      updatedTargets = updatedTargets.filter((coord, index) => {
        return (
          updatedTargets.findIndex(
            (findCoords) => findCoords.x == coord.x && findCoords.y === coord.y,
          ) === index
        );
      });
      // Update targets
      state.targets = updatedTargets;
      return state;
    },
  },
};
export default spell;
