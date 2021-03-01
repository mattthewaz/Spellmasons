import { setSelectedCard } from './SpellPool';
const elCardHolder = document.getElementById('card-holder');
export function clearCards() {
  elCardHolder.innerHTML = '';
}
// Cards are used for chanelling unique spells each turn.
// Both players are presented with a number of cards and they take turns deciding which to
// add to their chanelling spell orbs
export function generateCards(numberOfCards: number) {
  const cards = [];
  for (let i = 0; i < numberOfCards; i++) {
    const card = generateCard();
    const el = cardDOM(card, i);
    cards.push(el);
  }
}
const modifiers = ['dmg', 'heal', 'chain', 'freeze', 'aoe'];
function generateCard() {
  return modifiers[window.random.integer(0, modifiers.length - 1)];
}
function cardDOM(content: string, index: number) {
  const element = document.createElement('div');
  element.classList.add('card');
  element.id = 'card-' + index;
  const thumb = document.createElement('div');
  thumb.classList.add('card-thumb');
  element.appendChild(thumb);
  const desc = document.createElement('div');
  desc.classList.add('card-description');
  desc.innerText = content;
  element.appendChild(desc);
  element.addEventListener('click', () => {
    if (window.game.yourTurn) {
      if (element.classList.contains('disabled')) {
        // You cannot select disabled cards
        return;
      }
      setSelectedCard(content, element);
      // Remove selected from all cards
      document
        .querySelectorAll('.card')
        .forEach((el) => el.classList.remove('selected'));
      // Add selected to clicked card
      element.classList.add('selected');
    }
  });
  elCardHolder.appendChild(element);
  return element;
}

// <div class="card">
//   <div class="card-thumb"></div>
//   <div class="card-description"></div>
// </div>
