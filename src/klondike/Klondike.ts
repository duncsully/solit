import { styleMap } from 'lit/directives/style-map.js'
import { Writable, computed, state } from '../Observable'
import { html } from '../html'
import { Card, Rank, Suit } from './Card'
import { repeat } from 'lit/directives/repeat.js'
import { component, effect } from '../component'

// Validate hash state before using
// New game button + undo buttons
// FLIP animation?
// More efficient serialization (bitmask for tableau?)
// Better styling solution?
// Improve drop area
// Support 3 card draw
// Responsiveness

type Pile = number[]

export const Klondike = component(() => {
  // load state from hash
  const hash = window.location.hash.slice(1)
  const [
    stockString,
    wasteString = '',
    foundationString = '',
    ...tableauStrings
  ] = hash.split('|')

  const savedStock = stockString.split('').map(getCardId)
  const savedWaste = wasteString.split('').map(getCardId)
  const savedFoundation = foundationString.split('').map((char) => {
    if (char === '-') return []
    const id = getCardId(char)
    const value = getValue(id)
    const length = value + 1
    return Array.from({ length }, (_, i) => id - length + 1 + i)
  })
  const savedTableauFlippedIndices = tableauStrings.map((tableauString) =>
    tableauString.indexOf('-')
  )
  const savedTableau = tableauStrings.map((tableauString) => {
    const adjustedString = tableauString.replace(/-/g, '')
    return adjustedString.split('').map(getCardId)
  })

  const stock = state<Pile>(
    hash
      ? savedStock
      : Array.from({ length: 52 }, (_, i) => i).sort(() => Math.random() - 0.5)
  )
  const waste = state<Pile>(hash ? savedWaste : [])
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
  }

  /** Negative for use with .at() to make it easier to treat arrays as stacks */
  const selectedNegativeIndex = state(-1)
  const selectedPile = state(waste)

  const selectedCard = computed(
    () => selectedPile.get().get().at(selectedNegativeIndex.get())!
  )

  const handleWasteClick = () => {
    selectedPile.set(waste)
    selectedNegativeIndex.set(-1)
  }

  const foundationPiles = Array.from({ length: 4 }, (_, i) =>
    state<Pile>(hash ? savedFoundation[i] : [])
  )
  const makeHandleFoundationClick = (foundationPile: Writable<Pile>) => () => {
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
      selectedPile.set(waste)
      selectedNegativeIndex.set(-1)
    } else {
      selectedNegativeIndex.set(-1)
      selectedPile.set(foundationPile)
    }
    return false
  }

  const tableau = Array.from({ length: 7 }, (_, i) =>
    state<Pile>(hash ? savedTableau[i] : [])
  )
  // Deal cards to tableau
  // Technically not how it's supposed to be done, but it's easier to implement
  if (!hash) {
    tableau.forEach((pile, i) => {
      const cards = stock.get().slice(0, i + 1)
      pile.set(cards)
      stock.update((current) => [...current.slice(i + 1)])
    })
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

    if ((isKing && emptyPile) || (alternateColors && rankValid && !samePile)) {
      tableau[pileIndex].update((current) => [
        ...current,
        ...selectedPile.get().get().slice(selectedNegativeIndex.get()),
      ])
      selectedPile
        .get()!
        .update((current) => [...current.slice(0, selectedNegativeIndex.get())])
      selectedPile.set(tableau[pileIndex])
    } else if (
      tableauPile.length + cardNegativeIndex >=
      tableauFlippedIndices[pileIndex].get()
    ) {
      selectedNegativeIndex.set(cardNegativeIndex)
      selectedPile.set(tableau[pileIndex])
    }
  }
  const tableauFlippedIndices = tableau.map((_, i) =>
    state(hash ? savedTableauFlippedIndices[i] : i)
  )

  const handleDoubleClick = (pile: Writable<Pile>) => {
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
    }
  }

  // Automatically flip last card in tableau piles
  effect(() => {
    tableau.forEach((pile, i) => {
      if (tableauFlippedIndices[i].get() >= pile.get().length) {
        tableauFlippedIndices[i].set(pile.get().length - 1)
      }
    })
  })

  // Check win condition
  effect(() => {
    const won = foundationPiles.every(
      (foundation) => foundation.get().length === 13
    )
    if (won) {
      // This would trigger before the render update. Really ought to have effects trigger post render
      setTimeout(() => {
        alert('You won!')
        window.location.hash = ''
        window.location.reload()
      })
    }
  })

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
  const ignorePop = state<boolean | undefined>(undefined)

  // Serialize state to hash with card IDs represented by upper and lowercase letters
  effect(() => {
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

    ignorePop.update((current) => current !== undefined)
    window.location.hash = hash
  })

  // Make popstate reload state from hash
  effect(() => {
    const listener = () => {
      if (ignorePop.peek()) {
        ignorePop.set(false)
        return
      }
      window.location.reload()
    }
    window.addEventListener('popstate', listener)
    return () => window.removeEventListener('popstate', listener)
  })

  const emptyStyles = styleMap({
    width: '10rem',
    height: '14rem',
    border: '1px solid grey',
    borderRadius: '0.75rem',
  })

  return html`
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
  `
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
