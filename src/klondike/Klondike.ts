import { styleMap } from 'lit-html/directives/style-map.js'
import { Signal, batch, computed, signal } from '../Signal'
import { html } from '../html'
import { Card, Rank, Suit } from './Card'
import { repeat } from 'lit-html/directives/repeat.js'
import { component, effect } from '../component'

// Validate hash state before using
// Undo button?
// FLIP animation?
// More efficient serialization (bitmask for tableau?)
// Better styling solution?
// Improve drop area
// Support 3 card draw
// Responsiveness

function shuffleArray<T extends unknown[]>(array: T) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

type Pile = number[]

export const Klondike = component(() => {
  const stock = signal<Pile>([])
  const waste = signal<Pile>([])
  /** Negative for use with .at() to make it easier to treat arrays as stacks */
  const selectedNegativeIndex = signal(-1)
  const selectedPile = signal(waste)
  const selectedCard = computed(
    () => selectedPile.get().get().at(selectedNegativeIndex.get())!
  )
  const foundationPiles = Array.from({ length: 4 }, () => signal<Pile>([]))
  const tableau = Array.from({ length: 7 }, () => signal<Pile>([]))
  const tableauFlippedIndices = tableau.map((_, i) => signal(i))

  const handleStockClick = () => {
    if (stock.get().length === 0) {
      stock.set([...waste.get().reverse()])
      waste.set([])
    } else {
      const card = stock.get().at(-1)!
      stock.update((current) => [...current.slice(0, -1)])
      waste.update((current) => [...current, card])
    }
    selectedPile.set(waste)
    selectedNegativeIndex.set(-1)
    saveState()
  }

  const handleWasteClick = () => {
    selectedPile.set(waste)
    selectedNegativeIndex.set(-1)
    saveState()
  }

  const makeHandleFoundationClick = (foundationPile: Signal<Pile>) => () => {
    const cardToMove = selectedCard.get()
    const foundationCard = foundationPile.get().at(-1)
    const emptyFoundation = foundationCard === undefined
    const isAce = getValue(cardToMove) === 0
    const suitsMatch =
      !emptyFoundation && getSuit(cardToMove) === getSuit(foundationCard)
    const rankValid =
      !emptyFoundation && getValue(cardToMove) === getValue(foundationCard) + 1

    if (
      selectedNegativeIndex.get() === -1 &&
      ((isAce && emptyFoundation) || (suitsMatch && rankValid))
    ) {
      selectedPile.get().update((current) => [...current.slice(0, -1)])
      foundationPile.update((current) => [...current, cardToMove])
      checkTableauFlip()
      selectedPile.set(waste)
      selectedNegativeIndex.set(-1)
    } else {
      selectedNegativeIndex.set(-1)
      selectedPile.set(foundationPile)
    }
    saveState()

    return false
  }

  const handleTableauClick = (pileIndex: number, cardNegativeIndex: number) => {
    const tableauPile = tableau[pileIndex].get()
    const cardToMove = selectedCard.get()
    const tableauCard = tableauPile.at(cardNegativeIndex)
    const isKing = getValue(cardToMove) === 12
    const emptyPile = tableauCard === undefined
    const alternateColors =
      !emptyPile && isRed(cardToMove) !== isRed(tableauCard!)
    const rankValid =
      !emptyPile && getValue(cardToMove) === getValue(tableauCard!) - 1
    const samePile = selectedPile.get() === tableau[pileIndex]

    if (
      (isKing && emptyPile) ||
      (alternateColors && rankValid && !samePile && cardNegativeIndex === -1)
    ) {
      tableau[pileIndex].update((current) => [
        ...current,
        ...selectedPile.get().get().slice(selectedNegativeIndex.get()),
      ])
      selectedPile
        .get()!
        .update((current) => [...current.slice(0, selectedNegativeIndex.get())])

      checkTableauFlip()
      selectedPile.set(tableau[pileIndex])
    } else if (
      tableauPile.length + cardNegativeIndex >=
      tableauFlippedIndices[pileIndex].get()
    ) {
      selectedNegativeIndex.set(cardNegativeIndex)
      selectedPile.set(tableau[pileIndex])
    }
    saveState()
    checkWin()
  }

  const handleDoubleClick = (pile: Signal<Pile>) => {
    const card = pile.get().at(-1)!
    const foundationPile = foundationPiles.find((foundation) =>
      foundation.get().length
        ? getSuit(foundation.get().at(-1)!) === getSuit(card) &&
          getValue(foundation.get().at(-1)!) === getValue(card) - 1
        : getValue(card) === 0
    )
    if (foundationPile) {
      pile.update((current) => [...current.slice(0, -1)])
      foundationPile.update((current) => [...current, card])
      checkTableauFlip()
      saveState()
    }
    checkWin()
  }

  /** Flip last card in tableau pile that just had cards moved from it */
  function checkTableauFlip() {
    const flippedIndex =
      tableauFlippedIndices[tableau.indexOf(selectedPile.get())]
    if (flippedIndex && flippedIndex.get() >= selectedPile.get().get().length) {
      flippedIndex.set(selectedPile.get().get().length - 1)
    }
  }

  function newGame() {
    batch(() => {
      stock.set(shuffleArray(Array.from({ length: 52 }, (_, i) => i)))
      waste.set([])
      foundationPiles.forEach((pile) => pile.set([]))
      // Deal cards to tableau
      // Technically not how it's supposed to be done, but it's easier to implement
      tableau.forEach((pile, i) => {
        const cards = stock.get().slice(0, i + 1)
        pile.set(cards)
        stock.update((current) => [...current.slice(i + 1)])
      })
      tableauFlippedIndices.forEach((index, i) => index.set(i))
      saveState()
    })
  }

  function loadState(serializedState: string) {
    batch(() => {
      const [
        stockString,
        wasteString = '',
        foundationString = '',
        ...tableauStrings
      ] = serializedState.split('|')

      stock.set(stockString.split('').map(getCardId))
      waste.set(wasteString.split('').map(getCardId))
      foundationString.split('').forEach((char, i) => {
        if (char === '-') foundationPiles[i].set([])
        const id = getCardId(char)
        const value = getValue(id)
        const length = value + 1
        foundationPiles[i].set(
          Array.from({ length }, (_, i) => id - length + 1 + i)
        )
      })
      tableauStrings.forEach((tableauString, i) =>
        tableauFlippedIndices[i].set(tableauString.indexOf('-'))
      )
      tableauStrings.forEach((tableauString, i) => {
        const adjustedString = tableauString.replace('-', '')
        tableau[i].set(adjustedString.split('').map(getCardId))
      })
      selectedNegativeIndex.set(-1)
    })
  }

  // Check win condition
  const checkWin = () => {
    const won = foundationPiles.every(
      (foundation) => foundation.get().length === 13
    )
    if (won) {
      // This would trigger before the render update otherwise
      setTimeout(() => {
        alert('You won!')
        newGame()
      })
    }
  }

  const buildTableauPile = (pileIndex: number, index: number = 0) => {
    const pile = tableau[pileIndex].get()
    const card = pile.at(index)
    return Card({
      faceUp: tableauFlippedIndices[pileIndex].get() <= index,
      suit: getSuit(card!),
      rank: getRank(card!),
      onClick: (e) => {
        e.stopPropagation()
        handleTableauClick(pileIndex, index - pile.length)
      },
      onDoubleClick: (e) => {
        e.stopPropagation()
        handleDoubleClick(tableau[pileIndex])
      },
      stacked:
        pile.length > index + 1
          ? buildTableauPile(pileIndex, index + 1)
          : undefined,
      selected:
        selectedPile.get() === tableau[pileIndex] &&
        selectedNegativeIndex.get() === index - pile.length,
    })
  }

  /**
   * Due to the way the popstate event works, any hash change will trigger it, but we
   * can't be sure why the hash changed. This state is used to ignore the popstate event
   * when we know it was triggered by a hash change we made vs browser history navigation.
   */
  const ignorePop = signal<boolean | undefined>(undefined)

  // Serialize state to hash with card IDs represented by upper and lowercase letters
  const serializedState = computed(() => {
    const stockString = stock.get().reduce((acc, id) => acc + getChar(id), '')
    const wasteString = waste.get().reduce((acc, id) => acc + getChar(id), '')
    const foundationString = foundationPiles.reduce(
      (acc, pile) => acc + getChar(pile.get().at(-1)),
      ''
    )
    const tableauStrings = tableau.map((pile, i) => {
      return pile.get().reduce((acc, id, j) => {
        return `${acc}${
          tableauFlippedIndices[i].get() === j ? '-' : ''
        }${getChar(id)}`
      }, '')
    })

    const hash = `${stockString}|${wasteString}|${foundationString}|${tableauStrings.join(
      '|'
    )}`

    return hash
  })

  function saveState() {
    ignorePop.set(true)
    window.location.hash = serializedState.get()
  }

  // Make popstate reload state from hash
  effect(() => {
    const listener = () => {
      if (ignorePop.peek) {
        ignorePop.set(false)
        return
      }
      loadState(window.location.hash.slice(1))
      return false
    }
    window.addEventListener('popstate', listener)
    return () => window.removeEventListener('popstate', listener)
  })

  const hash = window.location.hash.slice(1)
  hash ? loadState(hash) : newGame()

  const handleNewGame = () => {
    if (confirm('Are you sure you want to start a new game?')) {
      newGame()
    }
  }

  const emptyStyles = styleMap({
    width: '10rem',
    height: '14rem',
    border: '1px solid grey',
    borderRadius: '0.75rem',
  })

  return html`<div>
    <button @click=${handleNewGame}>New Game</button>
    <div
      style=${styleMap({
        margin: '0 auto',
        padding: '0.5rem',
        display: 'grid',
        gap: '2rem',
        gridTemplateColumns: 'repeat(7, 10rem)',
      })}
    >
      <div @click=${handleStockClick}>
        ${() =>
          stock.get().length
            ? Card({ faceUp: false })
            : html`<div style=${emptyStyles}></div>`}
      </div>
      <div>
        ${() =>
          waste.get().length
            ? Card({
                faceUp: true,
                suit: getSuit(waste.get().at(-1)!),
                rank: getRank(waste.get().at(-1)!),
                onClick: handleWasteClick,
                onDoubleClick: () => handleDoubleClick(waste),
                selected: selectedPile.get() === waste,
              })
            : html`<div style=${emptyStyles}></div>`}
      </div>
      <div></div>

      ${repeat(
        foundationPiles,
        (_, i) => i,
        (pile) => html`
          <div>
            ${() =>
              pile.get().length
                ? Card({
                    faceUp: true,
                    suit: getSuit(pile.get().at(-1)!),
                    rank: getRank(pile.get().at(-1)!),
                    onClick: makeHandleFoundationClick(pile),
                    selected: selectedPile.get() === pile,
                  })
                : html`<div
                    style=${emptyStyles}
                    @click=${makeHandleFoundationClick(pile)}
                    @drop=${makeHandleFoundationClick(pile)}
                    @dragover=${(e: DragEvent) => e.preventDefault()}
                  ></div>`}
          </div>
        `
      )}
      ${repeat(
        tableau,
        (_, i) => i,
        (pile, i) => html`
          <div>
            ${() =>
              pile.get().length
                ? buildTableauPile(i)
                : html`<div
                    @click=${() => handleTableauClick(i, 0)}
                    @drop=${() => handleTableauClick(i, 0)}
                    @dragover=${(e: DragEvent) => e.preventDefault()}
                    style=${emptyStyles}
                  ></div>`}
          </div>
        `
      )}
    </div>
  </div>`
})

const getValue = (card: number) => card % 13

const getSuit = (card: number) =>
  [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades][Math.floor(card / 13)]

const getRank = (card: number) => {
  const value = getValue(card)
  const ranks = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
  ] as const
  return ranks[value] as Rank
}

const isRed = (card: number) =>
  getSuit(card) === Suit.Diamonds || getSuit(card) === Suit.Hearts

const getChar = (id?: number) =>
  id !== undefined ? String.fromCharCode(id + (id > 25 ? 71 : 65)) : '-'

const getCardId = (char: string) => {
  const code = char.charCodeAt(0)
  return code > 90 ? code - 71 : code - 65
}
