// Branching dialogue trees. Data only, so a future AI conversation layer can sit beside these
// (see interaction/DialogueSystem.js `provider`).
//
// Node fields: text, choices[{label, next | end}], learn {id, title, summary} (added to the Knowledge Journal).
// Placeholders: {name} = player's first name, {greeting} = time-of-day greeting.
// Factual statements are educational and general. No node recommends a specific investment.

const bye = (label = 'Thanks, that helps.') => ({ label, end: true });

export const DIALOGUES = {
  meera: {
    start: 'hello',
    nodes: {
      hello: {
        text: "{greeting}, {name}! I'm {self}, investment banker, based in FinVora Bank. I help companies raise money through IPOs and bonds, but every investor should first understand how ordinary banks work: they keep money safe and lend it out. What would you like to understand?",
        choices: [
          { label: 'Savings account or fixed deposit?', next: 'savings' },
          { label: 'How safe is money kept in a bank?', next: 'safety' },
          { label: 'What actually is a loan?', next: 'loan' },
          { label: 'What does an investment banker do?', next: 'ib' },
          bye('Just passing by.'),
        ],
      },
      savings: {
        text: "A savings account is for money you might need any day. It pays a modest rate, and banks in India work interest out on your daily balance. A fixed deposit locks money for a period you choose, from 7 days to 10 years, at a rate fixed on the day you open it. Break an FD early and the bank usually charges a penalty on the interest.",
        learn: { id: 'savings-vs-fd', title: 'Savings account vs fixed deposit', summary: 'Savings: flexible access, modest rate. FD: money locked for a chosen term at a rate fixed when opened; early withdrawal usually costs a penalty.' },
        choices: [{ label: 'And how is that money protected?', next: 'safety' }, { label: 'Tell me about loans.', next: 'loan' }, bye()],
      },
      safety: {
        text: "Bank deposits in India are insured by DICGC, a subsidiary of the RBI, up to ₹5 lakh per depositor per bank, principal and interest together. That limit has applied since 2020, but always check the current figure on DICGC's website. Money above it is not insured by DICGC.",
        learn: { id: 'deposit-insurance', title: 'Deposit insurance (DICGC)', summary: 'Deposits are insured up to ₹5 lakh per depositor per bank (limit since 2020; verify the current figure). Amounts above the limit are uninsured.' },
        choices: [{ label: 'Savings or FD, which is which?', next: 'savings' }, { label: 'What about loans?', next: 'loan' }, bye()],
      },
      ib: {
        text: "Investment bankers help companies and governments raise money from investors, for example by launching an IPO, selling bonds, or advising on mergers. In an IPO a company sells new shares to the public for the first time, after filing a detailed offer document with SEBI. Before applying for any IPO, read that document: the price is set by the company and its bankers, not by a guarantee of future gains.",
        learn: { id: 'investment-banking', title: 'What investment bankers do', summary: 'They help companies raise money (IPOs, bonds) and advise on deals. Read an IPO offer document before applying; listing gains are never guaranteed.' },
        choices: [{ label: 'How safe is money in a bank?', next: 'safety' }, bye()],
      },
      loan: {
        text: "A loan is rented money. You repay it with interest, usually through an EMI, an equated monthly instalment. Early EMIs are mostly interest and later ones are mostly principal, so a longer loan means paying much more interest in total. Try the Interest Wall inside the bank to see how fast compounding grows a balance.",
        learn: { id: 'emi-basics', title: 'Loans and EMIs', summary: 'An EMI is a fixed monthly payment. Early EMIs are mostly interest; a longer tenure lowers the EMI but raises total interest paid.' },
        choices: [{ label: 'Back to savings and FDs.', next: 'savings' }, bye('I will try the Interest Wall.')],
      },
    },
  },

  arjun: {
    start: 'hello',
    nodes: {
      hello: {
        text: "Can't stop long! Indian equity markets trade 9:15 to 3:30 on weekdays and I have clients. {self}, stock broker. Ask quick.",
        choices: [
          { label: 'What is a share, really?', next: 'share' },
          { label: 'How does buying a share work?', next: 'trade' },
          { label: 'Got a hot tip for me?', next: 'tip' },
          bye('Go, go, I will catch you later.'),
        ],
      },
      share: {
        text: "A share is a slice of ownership in a company. If a company has 1 crore shares and you own one, you own one crore-th of it, including a claim on its future profits. Prices move because buyers and sellers keep changing their view of what that future is worth.",
        learn: { id: 'what-is-a-share', title: 'What a share is', summary: 'A share is part-ownership of a company. Its price reflects what buyers and sellers think the company\'s future is worth, and that view changes constantly.' },
        choices: [{ label: 'So how do I actually buy one?', next: 'trade' }, bye()],
      },
      trade: {
        text: "You place an order through a SEBI-registered broker. The exchange, NSE or BSE, matches your buy order with someone else's sell order. Most Indian trades settle on T+1, so the shares reach your demat account one working day after the trade.",
        learn: { id: 't-plus-one', title: 'How a share trade settles', summary: 'Orders go through a SEBI-registered broker to NSE or BSE, which match buyers and sellers. Settlement is T+1: shares land in your demat account one working day later.' },
        choices: [{ label: 'Any tips, then?', next: 'tip' }, bye()],
      },
      tip: {
        text: "Ha. Anyone selling you a sure-shot tip is a warning sign, not an opportunity. I can explain how markets work. Nobody can honestly promise you what goes up next, and that includes me.",
        learn: { id: 'no-sure-shots', title: 'There are no sure-shot tips', summary: 'Guaranteed tips are a red flag. Market outcomes are uncertain; understanding beats prediction.' },
        choices: [{ label: 'Fair. What is a share again?', next: 'share' }, bye('Noted. Good luck today.')],
      },
    },
  },

  kavita: {
    start: 'hello',
    nodes: {
      hello: {
        text: "Welcome, {name}. I'm {self}. Three ideas will carry you a long way in finance: compounding, inflation and risk. Pick one and I'll keep it simple.",
        choices: [
          { label: 'Compounding', next: 'compound' },
          { label: 'Inflation', next: 'inflation' },
          { label: 'Risk', next: 'risk' },
          bye('Maybe another time.'),
        ],
      },
      compound: {
        text: "Compounding means earning returns on your earlier returns. ₹1,00,000 growing at 10% a year becomes ₹1,10,000 after one year, but about ₹2,59,374 after ten years, not ₹2,00,000. That extra ₹59,374 is interest on interest. Time matters as much as the rate.",
        learn: { id: 'compounding', title: 'Compounding', summary: 'Returns earn further returns. ₹1,00,000 at 10% a year for 10 years ≈ ₹2,59,374 (1.1^10), versus ₹2,00,000 with simple interest.' },
        choices: [{ label: 'Is there a quick way to estimate it?', next: 'rule72' }, { label: 'Now inflation, please.', next: 'inflation' }, bye()],
      },
      rule72: {
        text: "Yes: the Rule of 72. Divide 72 by the yearly return in percent to estimate how many years money takes to double. At 8%, about 9 years. The exact answer is ln 2 ÷ ln 1.08, roughly 9.01 years. The Doubling Lab inside the Academy counter in AccoFinTra Tower shows where the shortcut drifts.",
        learn: { id: 'rule-of-72', title: 'Rule of 72', summary: 'Years to double ≈ 72 ÷ annual return (%). Exact: ln 2 ÷ ln(1 + r). At 8%: 9 vs 9.01 years.' },
        choices: [{ label: 'And inflation?', next: 'inflation' }, { label: 'And risk?', next: 'risk' }, bye('I will visit the Doubling Lab.')],
      },
      inflation: {
        text: "Inflation is the general rise in prices. If prices climb 6% a year, something costing ₹100 today costs about ₹179 in ten years. So a 4% return during 6% inflation means your money buys less each year, even though the number on the screen grows.",
        learn: { id: 'inflation', title: 'Inflation and real returns', summary: 'At 6% inflation, ₹100 of goods costs ≈ ₹179 in 10 years. A return below inflation loses purchasing power.' },
        choices: [{ label: 'Tell me about risk.', next: 'risk' }, { label: 'Back to compounding.', next: 'compound' }, bye()],
      },
      risk: {
        text: "Risk is the chance that what happens differs from what you expected, losses included. Higher expected returns usually come with higher risk. Spreading money across different kinds of assets, diversification, limits the damage any single one can do. It reduces risk; it can't remove it.",
        learn: { id: 'diversification', title: 'Risk and diversification', summary: 'Higher expected return usually means higher risk. Diversifying across different assets limits the damage from any one, but cannot eliminate risk.' },
        choices: [{ label: 'Compounding next.', next: 'compound' }, bye('That makes sense.')],
      },
    },
  },

  ravi: {
    start: 'hello',
    nodes: {
      hello: {
        text: "Hey! I'm {self}. Started investing two years ago and made pretty much every beginner mistake. Want to hear one so you don't repeat it?",
        choices: [
          { label: 'Yes, what went wrong?', next: 'panic' },
          { label: 'What would you do differently?', next: 'concentrate' },
          { label: 'Where should a beginner even start?', next: 'emergency' },
          bye('Another time.'),
        ],
      },
      panic: {
        text: "My first year the market fell about 10% and I panicked and sold everything. That time it recovered within months, without me. Markets don't always bounce back that quickly, but selling in a panic turned a temporary fall into a permanent loss for me.",
        learn: { id: 'volatility', title: 'Volatility is not the same as loss', summary: 'Prices swing. Selling in panic can lock in a loss that might otherwise have been temporary. Decide your plan before the fall, not during it.' },
        choices: [{ label: 'What else did you learn?', next: 'concentrate' }, bye()],
      },
      concentrate: {
        text: "I once put almost everything into one hot stock a friend talked up. It halved. Now I spread money across different investments and invest a fixed amount every month, a habit people call an SIP, a systematic investment plan.",
        learn: { id: 'sip', title: 'Systematic investing (SIP)', summary: 'Investing a fixed amount regularly builds discipline and spreads purchases across good and bad prices. It does not guarantee profit.' },
        choices: [{ label: 'How do I start, though?', next: 'emergency' }, bye()],
      },
      emergency: {
        text: "Before investing anything, build an emergency fund. Many planners suggest three to six months of essential expenses kept somewhere safe and easy to withdraw. Then investing doesn't force you to sell at a bad moment.",
        learn: { id: 'emergency-fund', title: 'Emergency fund first', summary: 'Keep roughly 3 to 6 months of essential expenses in safe, easily withdrawable form before taking investment risk.' },
        choices: [{ label: 'Tell me the panic story.', next: 'panic' }, bye('Thanks. Good advice.')],
      },
    },
  },

  sana: {
    start: 'hello',
    nodes: {
      hello: {
        text: "{self}, fraud squad. In every city someone is promising money for nothing. Want to learn to spot them before they spot you?",
        choices: [
          { label: 'What are the warning signs?', next: 'flags' },
          { label: 'How do I check if someone is legitimate?', next: 'verify' },
          { label: 'Any scams I should know about?', next: 'upi' },
          bye('Stay safe.'),
        ],
      },
      flags: {
        text: "Three red flags. Guaranteed high returns. Pressure to decide right now. Requests to keep it secret or bring in friends. Real investments carry risk, and real advisers give you time to think.",
        learn: { id: 'fraud-red-flags', title: 'Fraud red flags', summary: 'Guaranteed high returns, urgency, secrecy or recruit-your-friends schemes are classic warning signs.' },
        choices: [{ label: 'How do I verify someone?', next: 'verify' }, bye()],
      },
      verify: {
        text: "Check registration. Investment advisers, research analysts and brokers must be registered with SEBI, and SEBI's website lets you search them. Banks and NBFCs are regulated by the RBI. No registration, no money.",
        learn: { id: 'verify-registration', title: 'Verify before you trust', summary: 'Look up advisers and brokers on SEBI\'s registry; banks and NBFCs are RBI-regulated. Unregistered means walk away.' },
        choices: [{ label: 'What scams are common?', next: 'upi' }, bye()],
      },
      upi: {
        text: "A common one: a stranger sends a UPI request claiming you'll receive money if you enter your PIN. You never need your UPI PIN to receive money; the PIN is only for paying. If you're ever defrauded in India, call the cyber crime helpline 1930 or report at cybercrime.gov.in, as quickly as you can.",
        learn: { id: 'upi-pin', title: 'UPI PIN is only for paying', summary: 'You never enter a UPI PIN to receive money. Report fraud fast: helpline 1930 or cybercrime.gov.in.' },
        choices: [{ label: 'And the general warning signs?', next: 'flags' }, bye('I will remember that.')],
      },
    },
  },

  'exchange-desk': {
    start: 'hello',
    speaker: { name: 'Help Desk', role: 'Exchange Guide', color: 0xd4a846 },
    nodes: {
      hello: {
        text: "Welcome to the FinVora Stock Exchange floor. I can explain what you're looking at.",
        choices: [
          { label: 'What does the market board show?', next: 'board' },
          { label: 'Why do prices move every few seconds?', next: 'moves' },
          bye('I will look around.'),
        ],
      },
      board: {
        text: "The board lists fictional companies with prices generated by FinVora's simulator. None of it is real market data. Real NSE and BSE prices need licensed data feeds, and wherever we show real data in future it will carry its source and timestamp.",
        learn: { id: 'simulated-data', title: 'Real vs simulated data', summary: 'FinVora labels every number: real, historical, fictional simulation or your own assumption. The Exchange board is fictional simulation.' },
        choices: [{ label: 'Why do they move so much?', next: 'moves' }, bye()],
      },
      moves: {
        text: "Each fictional stock follows a random walk with its own volatility. Notice how the riskier names swing harder in both directions. That's the trade-off you'll feel when you trade here with your virtual wallet: bigger potential gains come with bigger potential losses.",
        learn: { id: 'volatility-sim', title: 'Volatility cuts both ways', summary: 'More volatile assets swing further up and down. Potential reward and potential loss rise together.' },
        choices: [{ label: 'What does the board show again?', next: 'board' }, bye()],
      },
    },
  },

  'bank-desk': {
    start: 'hello',
    speaker: { name: 'Customer Desk', role: 'Banking District', color: 0x2fbf71 },
    nodes: {
      hello: {
        text: 'Good day! How can the customer desk help?',
        choices: [
          { label: 'What is a recurring deposit?', next: 'rd' },
          { label: 'How do credit cards charge interest?', next: 'cc' },
          bye('Nothing for now, thanks.'),
        ],
      },
      rd: {
        text: "A recurring deposit lets you put in a fixed amount every month for a chosen term, at a rate fixed when you open it. It's a disciplined way to save towards a goal, like an FD built one instalment at a time.",
        learn: { id: 'recurring-deposit', title: 'Recurring deposit (RD)', summary: 'Fixed monthly deposits for a set term at a rate fixed at opening. A savings habit with predictable growth.' },
        choices: [{ label: 'And credit cards?', next: 'cc' }, bye()],
      },
      cc: {
        text: "If you pay the full bill by the due date, you usually pay no interest on purchases. Carry a balance and interest is charged at high rates, often around 3 to 4% a month, which is over 40% a year. Paying only the minimum due keeps you in debt for a long time.",
        learn: { id: 'credit-card-interest', title: 'Credit card interest', summary: 'Pay the full bill on time and purchases are usually interest-free. Revolving balances often cost ~3–4% a month (40%+ a year).' },
        choices: [{ label: 'Tell me about RDs.', next: 'rd' }, bye('I will pay in full. Thanks.')],
      },
    },
  },

  'academy-desk': {
    start: 'hello',
    speaker: { name: 'Admissions', role: 'Financial Academy', color: 0xd4a846 },
    nodes: {
      hello: {
        text: "Welcome to the Academy counter in AccoFinTra Tower, {name}. Everyone in FinVora teaches something. Every idea you pick up in conversation is saved to your Knowledge Journal, which you can open from the menu.",
        choices: [
          { label: 'What will I be able to learn here?', next: 'tracks' },
          { label: 'Where should a complete beginner start?', next: 'start' },
          bye('Thanks!'),
        ],
      },
      tracks: {
        text: 'Every building in FinVora teaches something: trade at the Exchange, run SIPs at the Mutual Funds counter in AccoFinTra Tower, open FDs at the Bank, try PPF and NSC at the Small Savings counter in AccoFinTra Tower, and every calculator lives at the Calculators counter in AccoFinTra Tower. Here, try the Doubling Lab beside this desk.',
        choices: [{ label: 'Where should I start?', next: 'start' }, bye()],
      },
      start: {
        text: "Talk to people. {npc:financial-expert}, our Financial Expert, leads every helper in the city and can answer anything. {npc:professor} explains compounding, {npc:retail-investor} shares beginner mistakes, {npc:bank-manager} covers banking and {npc:fraud-investigator} teaches fraud safety. Twenty helpers live in FinVora and you can type any money question to them.",
        choices: [{ label: 'What tracks are there?', next: 'tracks' }, bye("I'll go find them.")],
      },
    },
  },
};
