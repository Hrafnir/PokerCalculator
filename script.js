document.addEventListener('DOMContentLoaded', () => {
    // --- Constants and Global State ---
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const suits = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
    const suitChars = Object.keys(suits);
    const rankValues = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

    const handRanks = [
        "Straight Flush", "Four of a Kind", "Full House", "Flush", "Straight",
        "Three of a Kind", "Two Pair", "One Pair", "High Card"
    ];
    const handRankValues = Object.fromEntries(handRanks.map((rank, i) => [rank, handRanks.length - 1 - i])); // Higher value = better hand

    let fullDeck = [];
    let currentDeck = [];
    let holeCards = [null, null];
    let communityCards = [null, null, null, null, null]; // flop1, flop2, flop3, turn, river
    let stage = 'pre-deal'; // 'pre-deal', 'pre-flop', 'flop', 'turn', 'river'

    // --- DOM References ---
    const statusMessage = document.getElementById('status-message');
    const dealRandomButton = document.getElementById('deal-random');
    const resetAllButton = document.getElementById('reset-all');
    const resultsArea = document.getElementById('results-area');
    const resultsStage = document.getElementById('results-stage');
    const probabilitiesDiv = document.getElementById('probabilities');
    const explanationDiv = document.getElementById('explanation');
    const currentHandRankDiv = document.getElementById('current-hand-rank');

    const playerCardPlaceholders = [document.getElementById('ph-card1'), document.getElementById('ph-card2')];
    const communityCardPlaceholders = [
        document.getElementById('flop1'), document.getElementById('flop2'), document.getElementById('flop3'),
        document.getElementById('turn'), document.getElementById('river')
    ];
    const holeCardSelectors = [
        { rank: document.getElementById('rank1'), suit: document.getElementById('suit1') },
        { rank: document.getElementById('rank2'), suit: document.getElementById('suit2') }
    ];
     const communityCardSelectors = [ // For manual input if needed later
        { rank: document.getElementById('rankF1'), suit: document.getElementById('suitF1') },
        { rank: document.getElementById('rankF2'), suit: document.getElementById('suitF2') },
        { rank: document.getElementById('rankF3'), suit: document.getElementById('suitF3') },
        { rank: document.getElementById('rankT'), suit: document.getElementById('suitT') },
        { rank: document.getElementById('rankR'), suit: document.getElementById('rankR') }
    ];

    const confirmHoleCardsButton = document.getElementById('confirm-holecards');
    const dealFlopButton = document.getElementById('deal-flop');
    const dealTurnButton = document.getElementById('deal-turn');
    const dealRiverButton = document.getElementById('deal-river');


    // --- Helper Functions ---
    function createDeck() {
        fullDeck = [];
        for (const suit of suitChars) {
            for (const rank of ranks) {
                fullDeck.push({ rank, suit, id: rank + suit, display: rank + suits[suit] });
            }
        }
        return fullDeck;
    }

    function shuffleDeck(deck) {
        // Fisher-Yates shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function dealCard(deck) {
        return deck.pop(); // Takes the last card
    }

    function formatPercentage(decimal) {
        return (decimal * 100).toFixed(2) + '%';
    }

    function factorial(n) {
        if (n < 0) return 0;
        if (n === 0 || n === 1) return 1;
        let result = 1;
        for (let i = n; i > 1; i--) {
            result *= i;
        }
        return result;
    }

     function combinations(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        if (k > n / 2) k = n - k;
        let res = 1;
        for (let i = 1; i <= k; ++i) {
            res = res * (n - i + 1) / i;
        }
        return Math.round(res); // Use Math.round for potential floating point issues
    }

    // Generate combinations of k elements from an array
    function getCombinations(arr, k) {
        if (k === 0) return [[]];
        if (arr.length === 0) return [];

        const first = arr[0];
        const rest = arr.slice(1);

        const combsWithFirst = getCombinations(rest, k - 1).map(comb => [first, ...comb]);
        const combsWithoutFirst = getCombinations(rest, k);

        return [...combsWithFirst, ...combsWithoutFirst];
    }


    function populateSelect(selectId, optionsArray, optionTexts = null) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '';
        const defaultOpt = document.createElement('option');
         defaultOpt.value = '';
         defaultOpt.textContent = '-'; // Default empty option
         select.appendChild(defaultOpt);
        optionsArray.forEach((option) => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = optionTexts ? optionTexts[option] : option;
            select.appendChild(opt);
        });
    }

    function displayCard(element, card) {
        if (!element) return;
         // Remove placeholder styles/content if they exist
        element.classList.remove('card-placeholder');
        element.innerHTML = ''; // Clear previous content (like selects)

        if (card) {
            element.textContent = card.display;
            element.classList.add('card');
            element.classList.toggle('red', card.suit === 'h' || card.suit === 'd');
            element.classList.remove('hidden'); // Ensure it's visible
        } else {
            // Reset to placeholder look
            element.textContent = ''; // Or add back placeholder text if needed
            element.className = 'card-placeholder'; // Reset classes
            element.classList.add('hidden'); // Hide if no card yet (like turn/river placeholders)
        }
    }

    function updateBoardDisplay() {
        displayCard(playerCardPlaceholders[0], holeCards[0]);
        displayCard(playerCardPlaceholders[1], holeCards[1]);
        communityCards.forEach((card, index) => {
            displayCard(communityCardPlaceholders[index], card);
        });

        // Hide/Show selectors based on whether card is dealt
        holeCardSelectors.forEach((sel, index) => {
            sel.rank.classList.toggle('hidden', !!holeCards[index]);
            sel.suit.classList.toggle('hidden', !!holeCards[index]);
        });

         // Hide community card placeholders initially
         communityCardPlaceholders.forEach((ph, index) => {
            ph.classList.toggle('hidden', !communityCards[index] && index >= 3); // Hide turn/river if not dealt
             if (!communityCards[index]) { // Reset text if empty
                 let placeholderText = '';
                 if (index < 3) placeholderText = `Flop ${index + 1}`;
                 else if (index === 3) placeholderText = 'Turn';
                 else if (index === 4) placeholderText = 'River';
                 ph.textContent = placeholderText;
                 ph.className = 'card-placeholder'; // Ensure it looks like a placeholder
                 ph.classList.toggle('hidden', index >=3); // Keep Turn/River hidden initially
             }
         });
    }


    // --- Hand Evaluation Logic (Simplified) ---
    // Input: An array of EXACTLY 5 card objects {rank, suit, id, display}
    // Output: { rankName: "Flush", rankValue: 5, highCards: [values], usesHoleCard: boolean (needs context) }
    // Note: This simplified version doesn't return the *best* 5 cards, just evaluates the given 5.
    //       Kicker handling is basic (based on sorted ranks).
     function evaluate5CardHand(fiveCards) {
        if (!fiveCards || fiveCards.length !== 5) return { rankName: "Invalid Hand", rankValue: -1, highCards: [] };

        const currentRanks = fiveCards.map(c => c.rank).sort((a, b) => rankValues[b] - rankValues[a]);
        const currentSuits = fiveCards.map(c => c.suit);
        const rankCounts = currentRanks.reduce((acc, rank) => { acc[rank] = (acc[rank] || 0) + 1; return acc; }, {});
        const counts = Object.values(rankCounts).sort((a, b) => b - a); // [3, 1, 1] for Three of a kind
        const highCardValues = currentRanks.map(r => rankValues[r]); // Sorted high to low

        const isFlush = new Set(currentSuits).size === 1;
        // Check for straight (Ace high/low handled)
        const uniqueRankValues = [...new Set(highCardValues)].sort((a, b) => b - a); // Sorted unique rank values
        let isStraight = false;
        if (uniqueRankValues.length >= 5) { // Need 5 unique ranks for a straight
            for (let i = 0; i <= uniqueRankValues.length - 5; i++) {
                 const slice = uniqueRankValues.slice(i, i + 5);
                 if (slice[0] - slice[4] === 4) {
                     isStraight = true;
                     // Adjust highCards for the straight found
                     // highCardValues = slice; // Use the straight ranks as primary comparison
                     break;
                 }
            }
        }
        // Ace-low straight (A, 2, 3, 4, 5) check -> unique ranks [14, 5, 4, 3, 2]
        if (!isStraight && uniqueRankValues.length === 5 && uniqueRankValues[0] === 14 && uniqueRankValues[1] === 5 && uniqueRankValues[4] === 2) {
             isStraight = true;
             // For A-5 straight, the high card is 5 for ranking purposes
            //  highCardValues = [5, 4, 3, 2, 1]; // Use adjusted values
            // Redefine highCardValues based on the straight
             highCardValues = [5, 4, 3, 2, 14]; // Keep Ace high for representation but 5 is rank value
        }

        if (isStraight && isFlush) return { rankName: "Straight Flush", rankValue: handRankValues["Straight Flush"], highCards: highCardValues };
        if (counts[0] === 4) return { rankName: "Four of a Kind", rankValue: handRankValues["Four of a Kind"], highCards: highCardValues };
        if (counts[0] === 3 && counts[1] === 2) return { rankName: "Full House", rankValue: handRankValues["Full House"], highCards: highCardValues };
        if (isFlush) return { rankName: "Flush", rankValue: handRankValues["Flush"], highCards: highCardValues };
        if (isStraight) return { rankName: "Straight", rankValue: handRankValues["Straight"], highCards: highCardValues };
        if (counts[0] === 3) return { rankName: "Three of a Kind", rankValue: handRankValues["Three of a Kind"], highCards: highCardValues };
        if (counts[0] === 2 && counts[1] === 2) return { rankName: "Two Pair", rankValue: handRankValues["Two Pair"], highCards: highCardValues };
        if (counts[0] === 2) return { rankName: "One Pair", rankValue: handRankValues["One Pair"], highCards: highCardValues };
        return { rankName: "High Card", rankValue: handRankValues["High Card"], highCards: highCardValues };
    }

    // --- Find Best 5-Card Hand from 7 Cards ---
    // Input: Array of 7 card objects, and the 2 hole card objects
    // Output: The best result from evaluate5CardHand, plus usesHoleCard boolean
    function findBestHandFrom7(sevenCards, originalHoleCards) {
         if (!sevenCards || sevenCards.length < 5) return { rankName: "Not Enough Cards", rankValue: -1, highCards: [], usesHoleCard: false };
         if (sevenCards.length > 7) sevenCards = sevenCards.slice(0,7); // Ensure max 7

        const possible5CardHands = getCombinations(sevenCards, 5);
        let bestHand = { rankName: "Invalid", rankValue: -1, highCards: [], usesHoleCard: false };

        for (const fiveCardHand of possible5CardHands) {
            const evalResult = evaluate5CardHand(fiveCardHand);

            // Compare with current best hand
            if (evalResult.rankValue > bestHand.rankValue) {
                bestHand = { ...evalResult, best5Cards: fiveCardHand }; // Store the cards forming the best hand
            } else if (evalResult.rankValue === bestHand.rankValue) {
                // Tie-breaker using high cards
                for (let i = 0; i < evalResult.highCards.length; i++) {
                     if (evalResult.highCards[i] > bestHand.highCards[i]) {
                         bestHand = { ...evalResult, best5Cards: fiveCardHand };
                         break;
                     }
                     if (evalResult.highCards[i] < bestHand.highCards[i]) {
                          break; // Current best is better
                     }
                     // If high cards are equal, continue checking next kicker
                }
            }
        }

        // Check if the best hand uses at least one hole card
        const bestHandCardIds = new Set(bestHand.best5Cards.map(c => c.id));
        bestHand.usesHoleCard = originalHoleCards.some(hc => hc && bestHandCardIds.has(hc.id));

        return bestHand;
    }


    // --- Probability Calculation ---
     function calculateProbabilities() {
        resultsArea.classList.remove('hidden');
        probabilitiesDiv.innerHTML = 'Beregner odds...';
        explanationDiv.innerHTML = ''; // Clear previous explanation
        currentHandRankDiv.innerHTML = ''; // Clear current hand rank

        // Need at least hole cards confirmed
        if (stage === 'pre-deal' || !holeCards[0] || !holeCards[1]) {
             probabilitiesDiv.innerHTML = 'Bekreft dine hole cards først.';
             return;
        }

        const knownCards = [...holeCards, ...communityCards].filter(c => c); // Filter out nulls
        const knownCardIds = new Set(knownCards.map(c => c.id));
        const remainingDeck = fullDeck.filter(c => !knownCardIds.has(c.id));

        let cardsToCome = 0;
        if (stage === 'pre-flop') cardsToCome = 5;
        else if (stage === 'flop') cardsToCome = 2;
        else if (stage === 'turn') cardsToCome = 1;
        else {
            // River stage - evaluate current best hand
            const finalHand = findBestHandFrom7(knownCards, holeCards);
             currentHandRankDiv.innerHTML = `Din beste hånd: <strong>${finalHand.rankName}</strong> ${finalHand.usesHoleCard ? '(bruker dine kort)' : '(spiller bordet)'}`;
            probabilitiesDiv.innerHTML = 'Alle kort er delt ut.';
            resultsStage.textContent = '(River)';
            return; // No more probabilities to calculate
        }

         resultsStage.textContent = `(etter ${stage === 'pre-flop' ? 'River' : stage === 'flop' ? 'River' : 'River'})`;

        const totalCombinations = combinations(remainingDeck.length, cardsToCome);
        if (totalCombinations === 0) {
             probabilitiesDiv.innerHTML = 'Kan ikke beregne (ingen kombinasjoner).';
             return;
        }

        const handCounts = {};
        const boardOnlyCounts = {}; // Count hands made only with community cards
        handRanks.forEach(rank => {
             handCounts[rank] = 0;
             boardOnlyCounts[rank] = 0;
        });
        let iterations = 0;

        // --- Enumeration (can be slow for pre-flop!) ---
        // Limit iterations for pre-flop for performance in browser?
        const maxIterations = (stage === 'pre-flop') ? 50000 : totalCombinations; // Limit pre-flop sim/enum
        let isSimulation = false;

         // Use simulation if pre-flop combos are too high for reasonable browser perf.
         // C(50, 5) = 2,118,760 - too many for direct enum.
         // C(47, 2) = 1,081 - feasible
         // C(46, 1) = 46 - feasible
         if (stage === 'pre-flop' && totalCombinations > maxIterations) {
              isSimulation = true;
              explanationDiv.innerHTML = `Beregner basert på ${maxIterations.toLocaleString()} tilfeldige simuleringer (av ${totalCombinations.toLocaleString()} mulige)...<br>`;
              let tempDeck = [...remainingDeck]; // Use a copy for simulation
              for (let i = 0; i < maxIterations; i++) {
                  shuffleDeck(tempDeck); // Shuffle remaining deck
                  const dealtCards = tempDeck.slice(0, cardsToCome);
                  const final7Cards = [...knownCards, ...dealtCards];
                  const result = findBestHandFrom7(final7Cards, holeCards);
                  if (handCounts[result.rankName] !== undefined) {
                      handCounts[result.rankName]++;
                      if (!result.usesHoleCard) {
                          boardOnlyCounts[result.rankName]++;
                      }
                  }
                  iterations++;
              }

         } else { // Enumeration for flop/turn
             explanationDiv.innerHTML = `Beregner basert på alle ${totalCombinations.toLocaleString()} mulige utfall...<br>`;
              const futureCardCombinations = getCombinations(remainingDeck, cardsToCome);
              for (const combo of futureCardCombinations) {
                  const final7Cards = [...knownCards, ...combo];
                  const result = findBestHandFrom7(final7Cards, holeCards);
                   if (handCounts[result.rankName] !== undefined) {
                       handCounts[result.rankName]++;
                       if (!result.usesHoleCard) {
                          boardOnlyCounts[result.rankName]++;
                      }
                   }
                  iterations++;
                  // Add a small delay to prevent freezing on slower machines (optional)
                  // if (iterations % 500 === 0) await new Promise(resolve => setTimeout(resolve, 0));
              }
         }


        // --- Display Results ---
        let tableHTML = '<table><thead><tr><th>Hånd</th><th>Total Sjanse</th><th>Kun Bordet</th></tr></thead><tbody>';
        for (const rank of handRanks) {
            const count = handCounts[rank];
            const boardCount = boardOnlyCounts[rank];
            if (count > 0) { // Only show hands that are possible
                const probability = count / iterations;
                const boardProbability = boardCount / iterations; // Probability of this hand playing the board
                tableHTML += `
                    <tr>
                        <td>${rank}</td>
                        <td>${formatPercentage(probability)}</td>
                        <td>${boardCount > 0 ? formatPercentage(boardProbability) : '-'}</td>
                    </tr>
                `;
            }
        }
        tableHTML += '</tbody></table>';

        probabilitiesDiv.innerHTML = tableHTML;

        // Display current hand if flop/turn
        if (stage === 'flop' || stage === 'turn') {
             const currentBestHand = findBestHandFrom7(knownCards, holeCards);
              currentHandRankDiv.innerHTML = `Nåværende beste hånd: <strong>${currentBestHand.rankName}</strong> ${currentBestHand.usesHoleCard ? '(bruker dine kort)' : '(spiller bordet)'}`;
              explanationDiv.innerHTML += `Din nåværende hånd er ${currentBestHand.rankName}. Oddsene over viser sjansen for å ende opp med de ulike hendene etter at alle kort er delt.`;
        } else {
             explanationDiv.innerHTML += `Oddsene viser sjansen for å ende opp med de ulike hendene etter at alle 5 felleskort er delt.`;
        }


    }

    // --- Event Listeners ---
    dealRandomButton.addEventListener('click', () => {
        resetGame();
        stage = 'pre-flop';
        currentDeck = shuffleDeck([...fullDeck]); // Use a copy

        holeCards[0] = dealCard(currentDeck);
        holeCards[1] = dealCard(currentDeck);

         // Update selects to match dealt cards (for consistency, though they'll be hidden)
         holeCardSelectors[0].rank.value = holeCards[0].rank;
         holeCardSelectors[0].suit.value = holeCards[0].suit;
         holeCardSelectors[1].rank.value = holeCards[1].rank;
         holeCardSelectors[1].suit.value = holeCards[1].suit;


        updateBoardDisplay();
        confirmHoleCardsButton.classList.add('hidden'); // Hide confirm as it was random
        dealFlopButton.classList.remove('hidden');
        statusMessage.textContent = 'Hole cards delt. Trykk "Del Flop".';
        resultsArea.classList.add('hidden'); // Hide results until calculated
        calculateProbabilities(); // Calculate pre-flop odds immediately
    });

    confirmHoleCardsButton.addEventListener('click', () => {
         const card1Rank = holeCardSelectors[0].rank.value;
         const card1Suit = holeCardSelectors[0].suit.value;
         const card2Rank = holeCardSelectors[1].rank.value;
         const card2Suit = holeCardSelectors[1].suit.value;

         if (!card1Rank || !card1Suit || !card2Rank || !card2Suit) {
             statusMessage.textContent = 'Velg rangering og farge for begge hole cards.';
             return;
         }
         const card1Id = card1Rank + card1Suit;
         const card2Id = card2Rank + card2Suit;

         if (card1Id === card2Id) {
             statusMessage.textContent = 'Du kan ikke velge samme kort to ganger.';
             return;
         }

         // Find the actual card objects from the full deck
         holeCards[0] = fullDeck.find(c => c.id === card1Id);
         holeCards[1] = fullDeck.find(c => c.id === card2Id);

         if (!holeCards[0] || !holeCards[1]) {
             statusMessage.textContent = 'Feil: Fant ikke de valgte kortene.'; // Should not happen
             return;
         }

         stage = 'pre-flop';
         currentDeck = fullDeck.filter(c => c.id !== card1Id && c.id !== card2Id);
         shuffleDeck(currentDeck);

         updateBoardDisplay();
         confirmHoleCardsButton.classList.add('hidden');
         dealFlopButton.classList.remove('hidden');
          statusMessage.textContent = 'Hole cards bekreftet. Trykk "Del Flop".';
         resultsArea.classList.add('hidden');
         calculateProbabilities();
     });


    dealFlopButton.addEventListener('click', () => {
        if (stage !== 'pre-flop' || currentDeck.length < 3) return;
        stage = 'flop';
        // Burn card (optional, doesn't affect odds)
        // dealCard(currentDeck);
        communityCards[0] = dealCard(currentDeck);
        communityCards[1] = dealCard(currentDeck);
        communityCards[2] = dealCard(currentDeck);
        updateBoardDisplay();
        dealFlopButton.classList.add('hidden');
        dealTurnButton.classList.remove('hidden');
        statusMessage.textContent = 'Flop delt. Trykk "Del Turn".';
        calculateProbabilities();
    });

    dealTurnButton.addEventListener('click', () => {
        if (stage !== 'flop' || currentDeck.length < 1) return;
        stage = 'turn';
        // Burn card
        // dealCard(currentDeck);
        communityCards[3] = dealCard(currentDeck);
        updateBoardDisplay();
        dealTurnButton.classList.add('hidden');
        dealRiverButton.classList.remove('hidden');
        statusMessage.textContent = 'Turn delt. Trykk "Del River".';
        calculateProbabilities();
    });

    dealRiverButton.addEventListener('click', () => {
        if (stage !== 'turn' || currentDeck.length < 1) return;
        stage = 'river';
        // Burn card
        // dealCard(currentDeck);
        communityCards[4] = dealCard(currentDeck);
        updateBoardDisplay();
        dealRiverButton.classList.add('hidden');
        statusMessage.textContent = 'River delt. Spillet er ferdig.';
        calculateProbabilities(); // Will show final hand rank
    });

    resetAllButton.addEventListener('click', resetGame);

    // --- Initialization ---
    function resetGame() {
        createDeck();
        currentDeck = [];
        holeCards = [null, null];
        communityCards = [null, null, null, null, null];
        stage = 'pre-deal';

        updateBoardDisplay(); // Resets cards to placeholders

        // Reset button visibility
        confirmHoleCardsButton.classList.remove('hidden');
        dealFlopButton.classList.add('hidden');
        dealTurnButton.classList.add('hidden');
        dealRiverButton.classList.add('hidden');

        // Reset selects
        holeCardSelectors.forEach(sel => { sel.rank.value = ''; sel.suit.value = ''; });
         // Optionally reset community selects if manual input is added later
         // communityCardSelectors.forEach(sel => { sel.rank.value = ''; sel.suit.value = ''; });

        resultsArea.classList.add('hidden');
        probabilitiesDiv.innerHTML = '';
        explanationDiv.innerHTML = '';
        currentHandRankDiv.innerHTML = '';
        statusMessage.textContent = 'Velg dine kort eller trykk "Del ut Tilfeldig".';

         // Ensure selectors are visible again for player cards
         holeCardSelectors.forEach((sel, index) => {
            sel.rank.classList.remove('hidden');
            sel.suit.classList.remove('hidden');
        });
    }

    function initializeApp() {
        createDeck();
        // Populate selects
        holeCardSelectors.forEach(sel => {
             populateSelect(sel.rank.id, ranks);
             populateSelect(sel.suit.id, suitChars, suits);
         });
         // Populate community selects (for potential future manual input)
         communityCardSelectors.forEach(sel => {
             populateSelect(sel.rank.id, ranks);
             populateSelect(sel.suit.id, suitChars, suits);
         });

        resetGame(); // Set initial state
    }

    initializeApp(); // Run on load
}); // End DOMContentLoaded
