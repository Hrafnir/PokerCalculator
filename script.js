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
    const handRankValues = Object.fromEntries(handRanks.map((rank, i) => [rank, handRanks.length - 1 - i]));

    let fullDeck = [];
    let currentDeck = []; // Cards *not* in play
    let holeCards = [null, null];
    let communityCards = [null, null, null, null, null]; // flop1, flop2, flop3, turn, river
    let stage = 'pre-deal'; // 'pre-deal', 'pre-flop', 'flop', 'turn', 'river'
    let calculationInProgress = false; // Flag to prevent overlapping calculations

    // --- DOM References ---
    const statusMessage = document.getElementById('status-message');
    const dealRandomHoleButton = document.getElementById('deal-random-hole');
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
    // Combined selectors for easier iteration
    const allSelectors = {
        h1: { rank: document.getElementById('rank1'), suit: document.getElementById('suit1'), cardIndex: 0, type: 'hole' },
        h2: { rank: document.getElementById('rank2'), suit: document.getElementById('suit2'), cardIndex: 1, type: 'hole' },
        f1: { rank: document.getElementById('rankF1'), suit: document.getElementById('suitF1'), cardIndex: 0, type: 'community' },
        f2: { rank: document.getElementById('rankF2'), suit: document.getElementById('suitF2'), cardIndex: 1, type: 'community' },
        f3: { rank: document.getElementById('rankF3'), suit: document.getElementById('suitF3'), cardIndex: 2, type: 'community' },
        t:  { rank: document.getElementById('rankT'), suit: document.getElementById('suitT'), cardIndex: 3, type: 'community' },
        r:  { rank: document.getElementById('rankR'), suit: document.getElementById('suitR'), cardIndex: 4, type: 'community' },
    };

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
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function dealCard(deck) {
        if (deck.length > 0) {
             return deck.pop();
         }
         setStatus('Error: Not enough cards in deck!', true);
         return null;
    }

    function formatPercentage(decimal) {
        return (decimal * 100).toFixed(2) + '%';
    }

     function combinations(n, k) {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        if (k > n / 2) k = n - k;
        // Use log gamma for potentially larger numbers if needed, but direct calc is fine for poker deck size
        let res = 1;
        for (let i = 1; i <= k; ++i) {
            // Check for potential overflow before multiplication if dealing with huge numbers
            res = res * (n - i + 1) / i;
        }
        // Return integer, potential floating point errors might need rounding for display, but keep precision for calcs
        // return Math.round(res);
        return res;
    }

    function getCombinations(arr, k) {
        if (k === 0) return [[]];
        if (!arr || arr.length < k) return []; // Handle empty or insufficient array

        let i, j, combs, head, tailcombs;
        combs = [];

        // Handle k=1 explicitly for efficiency
        if (k === 1) {
            for (i = 0; i < arr.length; i++) {
                combs.push([arr[i]]);
            }
            return combs;
        }

        // Recursive case
        for (i = 0; i <= arr.length - k; i++) {
            head = arr.slice(i, i + 1);
            tailcombs = getCombinations(arr.slice(i + 1), k - 1);
            for (j = 0; j < tailcombs.length; j++) {
                combs.push(head.concat(tailcombs[j]));
            }
        }
        return combs;
    }


    function populateSelect(select, optionsArray, optionTexts = null) {
        if (!select) return;
        select.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-';
        select.appendChild(defaultOpt);
        optionsArray.forEach((option) => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = optionTexts ? optionTexts[option] : option;
            select.appendChild(opt);
        });
    }

    function displayCard(placeholderElement, card) {
        if (!placeholderElement) return;
        placeholderElement.innerHTML = ''; // Clear previous content
        placeholderElement.classList.remove('card', 'red'); // Remove card styles

        if (card) {
            placeholderElement.textContent = card.display;
            placeholderElement.classList.add('card');
            placeholderElement.classList.toggle('red', card.suit === 'h' || card.suit === 'd');
        } else {
            // Reset to placeholder text (e.g., 'Kort 1', 'Flop 2')
            placeholderElement.textContent = placeholderElement.id.startsWith('ph-card') ? `Kort ${placeholderElement.id.slice(-1)}`
                                            : placeholderElement.id.startsWith('flop') ? `Flop ${placeholderElement.id.slice(-1)}`
                                            : placeholderElement.id.charAt(0).toUpperCase() + placeholderElement.id.slice(1); // Turn, River
            placeholderElement.className = 'card-placeholder'; // Reset class
        }
    }

    function updateBoardDisplay() {
        displayCard(playerCardPlaceholders[0], holeCards[0]);
        displayCard(playerCardPlaceholders[1], holeCards[1]);
        communityCards.forEach((card, index) => {
            displayCard(communityCardPlaceholders[index], card);
        });
    }

    function setStatus(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.classList.toggle('error', isError); // Add an error class if needed
        statusMessage.classList.remove('calculating'); // Remove calculating class by default
    }

    function setCalculatingStatus(message) {
        setStatus(message);
        statusMessage.classList.add('calculating');
    }

     function disableControls(disable = true) {
        calculationInProgress = disable;
        confirmHoleCardsButton.disabled = disable || stage !== 'pre-deal';
        dealRandomHoleButton.disabled = disable || stage !== 'pre-deal';
        dealFlopButton.disabled = disable || stage !== 'pre-flop';
        dealTurnButton.disabled = disable || stage !== 'flop';
        dealRiverButton.disabled = disable || stage !== 'turn';
        resetAllButton.disabled = disable;
        // Disable selects too? Maybe not, allow viewing but not changing?
        // For simplicity, we leave selects enabled but rely on button disabling.
    }

    // --- Hand Evaluation Logic (Same as before) ---
     function evaluate5CardHand(fiveCards) {
        // ... (Keep the evaluate5CardHand function from the previous version) ...
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
        let straightHighCard = 0; // Store the highest card of the straight

        if (uniqueRankValues.length >= 5) {
            for (let i = 0; i <= uniqueRankValues.length - 5; i++) {
                 const slice = uniqueRankValues.slice(i, i + 5);
                 if (slice[0] - slice[4] === 4) {
                     isStraight = true;
                     straightHighCard = slice[0]; // Highest card in this straight
                     break;
                 }
            }
        }
        // Ace-low straight (A, 2, 3, 4, 5) check -> unique ranks [14, 5, 4, 3, 2]
        const hasAceLow = uniqueRankValues.length >= 5 && uniqueRankValues.includes(14) && uniqueRankValues.includes(2) && uniqueRankValues.includes(3) && uniqueRankValues.includes(4) && uniqueRankValues.includes(5);
        if (!isStraight && hasAceLow) {
             isStraight = true;
             straightHighCard = 5; // Ace-low straight's highest card is 5 for ranking
        }

        // Determine highCards based on hand rank for tie-breaking
        let comparisonCards = highCardValues; // Default to sorted ranks

        if (isStraight || isFlush) {
             comparisonCards = straightHighCard > 0 ? [straightHighCard] : highCardValues; // Use straight high card or flush high cards
              if (isStraight && isFlush) comparisonCards = [straightHighCard]; // Straight flush highest card
              else if (isFlush) comparisonCards = highCardValues; // Use all 5 cards for flush comparison
              else if (isStraight) comparisonCards = [straightHighCard]; // Use highest card of straight
         } else if (counts[0] === 4) { // Four of a kind
             const fourRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 4), 10);
             const kicker = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 1), 10);
             comparisonCards = [fourRank, kicker];
         } else if (counts[0] === 3 && counts[1] === 2) { // Full House
             const threeRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3), 10);
             const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2), 10);
             comparisonCards = [threeRank, pairRank];
         } else if (counts[0] === 3) { // Three of a Kind
             const threeRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3), 10);
             const kickers = highCardValues.filter(v => v !== threeRank).slice(0, 2);
             comparisonCards = [threeRank, ...kickers];
         } else if (counts[0] === 2 && counts[1] === 2) { // Two Pair
             const pairs = Object.keys(rankCounts).filter(k => rankCounts[k] === 2).map(r => rankValues[r]).sort((a,b)=>b-a);
             const kicker = highCardValues.find(v => v !== pairs[0] && v !== pairs[1]);
             comparisonCards = [...pairs, kicker];
         } else if (counts[0] === 2) { // One Pair
             const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2), 10);
             const kickers = highCardValues.filter(v => v !== pairRank).slice(0, 3);
             comparisonCards = [pairRank, ...kickers];
         }
         // For High Card, comparisonCards remains the sorted highCardValues

        if (isStraight && isFlush) return { rankName: "Straight Flush", rankValue: handRankValues["Straight Flush"], highCards: comparisonCards };
        if (counts[0] === 4) return { rankName: "Four of a Kind", rankValue: handRankValues["Four of a Kind"], highCards: comparisonCards };
        if (counts[0] === 3 && counts[1] === 2) return { rankName: "Full House", rankValue: handRankValues["Full House"], highCards: comparisonCards };
        if (isFlush) return { rankName: "Flush", rankValue: handRankValues["Flush"], highCards: comparisonCards };
        if (isStraight) return { rankName: "Straight", rankValue: handRankValues["Straight"], highCards: comparisonCards };
        if (counts[0] === 3) return { rankName: "Three of a Kind", rankValue: handRankValues["Three of a Kind"], highCards: comparisonCards };
        if (counts[0] === 2 && counts[1] === 2) return { rankName: "Two Pair", rankValue: handRankValues["Two Pair"], highCards: comparisonCards };
        if (counts[0] === 2) return { rankName: "One Pair", rankValue: handRankValues["One Pair"], highCards: comparisonCards };
        return { rankName: "High Card", rankValue: handRankValues["High Card"], highCards: comparisonCards };
     }

    function findBestHandFrom7(sevenCards, originalHoleCards) {
        // ... (Keep the findBestHandFrom7 function from the previous version, ensuring it uses the updated evaluate5CardHand) ...
         if (!sevenCards || sevenCards.length < 5) return { rankName: "Not Enough Cards", rankValue: -1, highCards: [], usesHoleCard: false, best5Cards: [] };
         if (sevenCards.length > 7) sevenCards = sevenCards.slice(0,7); // Ensure max 7

        const possible5CardHands = getCombinations(sevenCards, 5);
        let bestHand = { rankName: "Invalid", rankValue: -1, highCards: [], usesHoleCard: false, best5Cards: [] };

        for (const fiveCardHand of possible5CardHands) {
             if (!fiveCardHand || fiveCardHand.length !== 5) continue; // Skip invalid combos if getCombinations has issues
            const evalResult = evaluate5CardHand(fiveCardHand);

            // Compare with current best hand
            if (evalResult.rankValue > bestHand.rankValue) {
                bestHand = { ...evalResult, best5Cards: fiveCardHand };
            } else if (evalResult.rankValue === bestHand.rankValue && evalResult.highCards && bestHand.highCards) {
                // Tie-breaker using high cards from evaluate5CardHand
                for (let i = 0; i < Math.min(evalResult.highCards.length, bestHand.highCards.length); i++) {
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
         if (bestHand.best5Cards && bestHand.best5Cards.length > 0 && originalHoleCards && originalHoleCards[0] && originalHoleCards[1]) {
            const bestHandCardIds = new Set(bestHand.best5Cards.map(c => c.id));
            bestHand.usesHoleCard = originalHoleCards.some(hc => hc && bestHandCardIds.has(hc.id));
         } else {
              bestHand.usesHoleCard = false; // Default if something is missing
         }


        return bestHand;
    }

    // --- Validation ---
    function validateSelections() {
        const selectedCards = [];
        const cardIds = new Set();
        let isValid = true;

        // Get selected hole cards
        if (holeCards[0]) selectedCards.push(holeCards[0].id);
        if (holeCards[1]) selectedCards.push(holeCards[1].id);

         // Get selected community cards
         for(let i=0; i < communityCards.length; i++) {
             if(communityCards[i]) {
                 selectedCards.push(communityCards[i].id);
             }
         }

         // Check from selectors for potentially unconfirmed cards
         const selectorKeys = ['h1', 'h2', 'f1', 'f2', 'f3', 't', 'r'];
         selectorKeys.forEach(key => {
             const selector = allSelectors[key];
             const rank = selector.rank.value;
             const suit = selector.suit.value;
             const cardIsInHandArray = (selector.type === 'hole' && holeCards[selector.cardIndex]) ||
                                       (selector.type === 'community' && communityCards[selector.cardIndex]);

             if (rank && suit && !cardIsInHandArray) { // Only check selectors for cards not yet confirmed/dealt
                  selectedCards.push(rank + suit);
              }
         });

        for (const cardId of selectedCards) {
            if (cardIds.has(cardId)) {
                setStatus(`Feil: Kortet ${cardId.slice(0, -1)}${suits[cardId.slice(-1)]} er valgt mer enn én gang!`, true);
                isValid = false;
                break;
            }
            cardIds.add(cardId);
        }

        if (isValid) setStatus(''); // Clear error message if valid
        return isValid;
    }

    // --- Core Calculation Logic ---
    async function calculateProbabilities() {
        if (calculationInProgress) {
             setStatus('Vennligst vent, forrige beregning pågår.', true);
             return;
        }
         if (stage === 'pre-deal') {
             resultsArea.classList.add('hidden');
             return; // Nothing to calculate yet
         }

        disableControls(true);
        resultsArea.classList.remove('hidden');
        probabilitiesDiv.innerHTML = 'Initialiserer beregning...';
        currentHandRankDiv.innerHTML = ''; // Clear previous rank
        explanationDiv.innerHTML = '';

        // Short delay to allow UI update before heavy calculation
        await new Promise(resolve => setTimeout(resolve, 50));

        const knownCards = [...holeCards, ...communityCards].filter(c => c);
        const knownCardIds = new Set(knownCards.map(c => c.id));

        // --- Evaluate and Display Current Hand (if flop or later) ---
        if (stage === 'flop' || stage === 'turn' || stage === 'river') {
            const currentBestHand = findBestHandFrom7(knownCards, holeCards);
            if (currentBestHand.rankValue > -1) {
                 currentHandRankDiv.innerHTML = `Nåværende beste hånd: <strong>${currentBestHand.rankName}</strong> ${currentBestHand.usesHoleCard ? '(bruker dine kort)' : '(spiller bordet)'}`;
             } else {
                 currentHandRankDiv.innerHTML = 'Kan ikke evaluere nåværende hånd.';
             }
        }

        if (stage === 'river') {
            probabilitiesDiv.innerHTML = 'Alle kort er delt ut.';
            resultsStage.textContent = '(River)';
            disableControls(false); // Re-enable controls
             resetAllButton.disabled = false; // Ensure reset is always possible
            return; // No future probabilities
        }

        // --- Calculate Future Probabilities ---
        const remainingDeck = fullDeck.filter(c => !knownCardIds.has(c.id));
        let cardsToCome = 0;
        if (stage === 'pre-flop') cardsToCome = 5;
        else if (stage === 'flop') cardsToCome = 2;
        else if (stage === 'turn') cardsToCome = 1;

        resultsStage.textContent = `(etter ${stage === 'pre-flop' ? 'River' : stage === 'flop' ? 'River' : 'River'})`;

        const totalCombinations = combinations(remainingDeck.length, cardsToCome);

        if (totalCombinations <= 0 || remainingDeck.length < cardsToCome) {
            probabilitiesDiv.innerHTML = 'Kan ikke beregne (ugyldig antall kort).';
            explanationDiv.innerHTML = `Trenger ${cardsToCome} kort til, men bare ${remainingDeck.length} igjen i stokken.`;
             disableControls(false); // Re-enable controls
             resetAllButton.disabled = false;
            return;
        }

        const calculationMessage = `Beregner ${totalCombinations.toLocaleString()} mulige utfall... ${stage === 'pre-flop' ? '(Dette kan ta en stund!)' : ''}`;
        setCalculatingStatus(calculationMessage);
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50));


        const handCounts = {};
        const boardOnlyCounts = {};
        handRanks.forEach(rank => {
            handCounts[rank] = 0;
            boardOnlyCounts[rank] = 0;
        });
        let iterations = 0;
        const updateInterval = Math.max(1000, Math.floor(totalCombinations / 20)); // Update status roughly 20 times

        try {
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

                 if (iterations % updateInterval === 0) {
                      setCalculatingStatus(`Beregner... ${((iterations / totalCombinations) * 100).toFixed(0)}% fullført (${iterations.toLocaleString()}/${totalCombinations.toLocaleString()})`);
                      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to browser
                 }
             }

             // --- Display Final Results ---
            let tableHTML = '<table><thead><tr><th>Hånd</th><th>Total Sjanse</th><th>Kun Bordet</th></tr></thead><tbody>';
            let foundHands = false;
            for (const rank of handRanks) {
                const count = handCounts[rank];
                if (count > 0) {
                    foundHands = true;
                    const boardCount = boardOnlyCounts[rank];
                    const probability = count / totalCombinations; // Use totalCombinations now
                    const boardProbability = boardCount / totalCombinations;
                    tableHTML += `
                        <tr>
                            <td>${rank}</td>
                            <td>${formatPercentage(probability)}</td>
                            <td>${boardCount > 0 ? formatPercentage(boardProbability) : '-'}</td>
                        </tr>
                    `;
                }
            }
             if (!foundHands) {
                 tableHTML += '<tr><td colspan="3">Ingen mulige hender funnet (feil?).</td></tr>';
             }
            tableHTML += '</tbody></table>';
            probabilitiesDiv.innerHTML = tableHTML;
            setStatus('Beregning fullført.'); // Clear calculating status

        } catch (error) {
             console.error("Error during probability calculation:", error);
             setStatus('En feil oppstod under beregningen.', true);
             probabilitiesDiv.innerHTML = 'Kunne ikke fullføre beregningen.';
        } finally {
             disableControls(false); // Ensure controls are re-enabled
             resetAllButton.disabled = false;
        }
    }


    // --- Event Handlers ---
    dealRandomHoleButton.addEventListener('click', () => {
        if (stage !== 'pre-deal') return;
        resetGame(); // Start fresh
        currentDeck = shuffleDeck([...fullDeck]);

        holeCards[0] = dealCard(currentDeck);
        holeCards[1] = dealCard(currentDeck);
        if (!holeCards[0] || !holeCards[1]) return; // Error handled in dealCard

        // Update display and state
        updateBoardDisplay();
        disableManualInputsForConfirmedCards(); // Disable selects for dealt cards
        confirmHoleCardsButton.classList.add('hidden'); // Hide confirm button
        dealFlopButton.classList.remove('hidden');
        dealFlopButton.disabled = false;
        stage = 'pre-flop';
        setStatus('Tilfeldige hole cards delt. Bekreft/del flop.');
        calculateProbabilities(); // Calculate pre-flop odds
    });

    confirmHoleCardsButton.addEventListener('click', () => {
        if (stage !== 'pre-deal') return;

        const card1Rank = allSelectors.h1.rank.value;
        const card1Suit = allSelectors.h1.suit.value;
        const card2Rank = allSelectors.h2.rank.value;
        const card2Suit = allSelectors.h2.suit.value;

        if (!card1Rank || !card1Suit || !card2Rank || !card2Suit) {
            setStatus('Velg rangering og farge for begge hole cards.', true);
            return;
        }
        const card1Id = card1Rank + card1Suit;
        const card2Id = card2Rank + card2Suit;

        if (card1Id === card2Id) {
            setStatus('Du kan ikke velge samme kort to ganger.', true);
            return;
        }

        holeCards[0] = fullDeck.find(c => c.id === card1Id);
        holeCards[1] = fullDeck.find(c => c.id === card2Id);

        if (!holeCards[0] || !holeCards[1]) {
            setStatus('Feil: Kunne ikke finne valgte kort i stokken.', true);
            return; // Should not happen if selects are populated correctly
        }

        currentDeck = fullDeck.filter(c => c.id !== card1Id && c.id !== card2Id);
        shuffleDeck(currentDeck);

        updateBoardDisplay();
        disableManualInputsForConfirmedCards();
        confirmHoleCardsButton.classList.add('hidden'); // Hide confirm button
        dealFlopButton.classList.remove('hidden');
        dealFlopButton.disabled = false;
        stage = 'pre-flop';
        setStatus('Hole cards bekreftet. Bekreft/del flop.');
        calculateProbabilities();
    });

    // Generic function to handle Flop, Turn, River dealing/confirmation
    function handleCommunityCardStage(buttonId, stageName, numCards, nextStage, nextButtonId) {
         const button = document.getElementById(buttonId);
         button.addEventListener('click', async () => { // Make async for await calculateProbabilities
             if (stage !== stageName || calculationInProgress) return;

             const cardSelectors = [];
             if (stageName === 'pre-flop') cardSelectors.push(allSelectors.f1, allSelectors.f2, allSelectors.f3);
             else if (stageName === 'flop') cardSelectors.push(allSelectors.t);
             else if (stageName === 'turn') cardSelectors.push(allSelectors.r);

             let cardsToConfirm = [];
             let manualInput = false;
             let manualInputComplete = true;

             for (const selector of cardSelectors) {
                 const rank = selector.rank.value;
                 const suit = selector.suit.value;
                 if (rank && suit) {
                     manualInput = true;
                     const cardId = rank + suit;
                     const card = fullDeck.find(c => c.id === cardId);
                     if (card) {
                         cardsToConfirm.push(card);
                     } else {
                          setStatus(`Feil: Ugyldig manuelt kort valgt (${cardId}).`, true);
                          manualInputComplete = false; // Mark as incomplete
                          break; // Exit loop on first invalid card
                     }
                 } else {
                      manualInputComplete = false; // Mark as incomplete if any manual field is empty
                 }
             }

             // If any manual input was attempted but not completed for all cards of the stage
             if (manualInput && !manualInputComplete && cardsToConfirm.length !== numCards) {
                  setStatus(`Fyll ut alle ${numCards} kort for ${stageName === 'pre-flop' ? 'floppen' : stageName === 'flop' ? 'turn' : 'river'} manuelt, eller la feltene stå tomme for tilfeldig utdeling.`, true);
                  return;
             }
             // If manual input is complete and correct number of cards selected
              else if (manualInput && manualInputComplete) {
                  // Validate against ALL known cards (including previous stages)
                  const knownCards = [...holeCards, ...communityCards].filter(c => c);
                  const knownIds = new Set(knownCards.map(c => c.id));
                  const newIds = new Set();
                  let duplicateFound = false;
                  for (const card of cardsToConfirm) {
                       if (knownIds.has(card.id) || newIds.has(card.id)) {
                           setStatus(`Feil: Kortet ${card.display} er allerede i spill eller valgt flere ganger!`, true);
                           duplicateFound = true;
                           break;
                       }
                       newIds.add(card.id);
                   }
                   if (duplicateFound) return;

                   // Confirm manually selected cards
                   let currentCommunityIndex = communityCards.findIndex(c => c === null); // Find first empty slot
                   cardsToConfirm.forEach(card => {
                       if (currentCommunityIndex !== -1 && currentCommunityIndex < 5) {
                           communityCards[currentCommunityIndex] = card;
                           currentCommunityIndex++;
                       }
                   });
                  // Remove confirmed cards from deck
                  const confirmedIds = new Set(cardsToConfirm.map(c => c.id));
                  currentDeck = currentDeck.filter(c => !confirmedIds.has(c.id));

             } else { // Deal randomly
                 if (currentDeck.length < numCards) {
                      setStatus(`Feil: Ikke nok kort igjen i stokken (${currentDeck.length}) til å dele ${numCards} kort.`, true);
                      return;
                  }
                  // Burn card (optional visual/mental step, no impact on odds calculation)
                  // if (currentDeck.length > numCards) dealCard(currentDeck);

                  let currentCommunityIndex = communityCards.findIndex(c => c === null);
                  for (let i = 0; i < numCards; i++) {
                      const dealtCard = dealCard(currentDeck);
                       if (dealtCard && currentCommunityIndex !== -1 && currentCommunityIndex < 5) {
                           communityCards[currentCommunityIndex] = dealtCard;
                           currentCommunityIndex++;
                       } else if (!dealtCard) {
                           return; // Error dealing card
                       }
                  }
             }

             // Update state and UI
             stage = nextStage;
             updateBoardDisplay();
             disableManualInputsForConfirmedCards();
             button.classList.add('hidden');
             if (nextButtonId) {
                 const nextButton = document.getElementById(nextButtonId);
                 nextButton.classList.remove('hidden');
                 nextButton.disabled = false;
             }
             setStatus(`${stageName === 'pre-flop' ? 'Flop' : stageName === 'flop' ? 'Turn' : 'River'} bekreftet/delt. ${nextButtonId ? 'Bekreft/del neste.' : 'Alle kort delt.'}`);
              await calculateProbabilities(); // Use await here
         });
    }

    handleCommunityCardStage('deal-flop', 'pre-flop', 3, 'flop', 'deal-turn');
    handleCommunityCardStage('deal-turn', 'flop', 1, 'turn', 'deal-river');
    handleCommunityCardStage('deal-river', 'turn', 1, 'river', null); // No next button


    resetAllButton.addEventListener('click', resetGame);

    // --- Initialization ---
    function disableManualInputsForConfirmedCards() {
        // Hole cards
        allSelectors.h1.rank.disabled = !!holeCards[0];
        allSelectors.h1.suit.disabled = !!holeCards[0];
        allSelectors.h2.rank.disabled = !!holeCards[1];
        allSelectors.h2.suit.disabled = !!holeCards[1];
        // Community cards
        allSelectors.f1.rank.disabled = !!communityCards[0];
        allSelectors.f1.suit.disabled = !!communityCards[0];
        allSelectors.f2.rank.disabled = !!communityCards[1];
        allSelectors.f2.suit.disabled = !!communityCards[1];
        allSelectors.f3.rank.disabled = !!communityCards[2];
        allSelectors.f3.suit.disabled = !!communityCards[2];
        allSelectors.t.rank.disabled = !!communityCards[3];
        allSelectors.t.suit.disabled = !!communityCards[3];
        allSelectors.r.rank.disabled = !!communityCards[4];
        allSelectors.r.suit.disabled = !!communityCards[4];
    }

    function resetGame() {
        createDeck();
        currentDeck = [];
        holeCards = [null, null];
        communityCards = [null, null, null, null, null];
        stage = 'pre-deal';
        calculationInProgress = false;

        // Clear displays and reset inputs
        updateBoardDisplay();
         for (const key in allSelectors) {
            allSelectors[key].rank.value = '';
            allSelectors[key].suit.value = '';
            allSelectors[key].rank.disabled = false; // Re-enable selects
            allSelectors[key].suit.disabled = false;
        }

        // Reset button visibility and state
        confirmHoleCardsButton.classList.remove('hidden');
        confirmHoleCardsButton.disabled = false;
        dealRandomHoleButton.disabled = false;
        dealFlopButton.classList.add('hidden');
        dealTurnButton.classList.add('hidden');
        dealRiverButton.classList.add('hidden');
        dealFlopButton.disabled = true; // Start disabled
        dealTurnButton.disabled = true;
        dealRiverButton.disabled = true;
        resetAllButton.disabled = false; // Reset should always be enabled


        resultsArea.classList.add('hidden');
        probabilitiesDiv.innerHTML = '';
        explanationDiv.innerHTML = '';
        currentHandRankDiv.innerHTML = '';
        setStatus('Velg dine kort eller trykk "Del ut Tilfeldig".');
    }

    function initializeApp() {
        createDeck();
        // Populate all selects
        for (const key in allSelectors) {
            populateSelect(allSelectors[key].rank, ranks);
            populateSelect(allSelectors[key].suit, suitChars, suits);
        }
        resetGame(); // Set initial state
    }

    initializeApp(); // Run on load

}); // End DOMContentLoaded
