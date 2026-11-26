"""Automated playtest of the single-file build, opened straight from disk (file://) in headless Chromium.
Usage: python3 tests/playtest.py file:///abs/path/dist/index.html ./shots
"""
import sys, json, math
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
ROADS = [-225, -175, -125, -75, -25, 25, 75, 125, 175, 225]
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files']
results, errors = [], []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))

snap = lambda p: p.evaluate('window.__finworld && window.__finworld.debugSnapshot()')
def hold(page, key, ms): page.keyboard.down(key); page.wait_for_timeout(ms); page.keyboard.up(key)

def start(page, name='Tester'):
    page.goto(URL)
    page.wait_for_selector('text=WELCOME TO FIN', timeout=20000)
    page.fill('#g-name', name)
    page.click('text=Play now')
    page.wait_for_selector('[data-go]', timeout=40000)

def go_door(page, bid):
    page.evaluate(f"""(() => {{ const g = window.__finworld; const d = g.city.doors.find(d => d.building.id === '{bid}');
        g.player.place(d.x, d.z, d.face); g.cam.snapBehind(d.face); }})()""")
    page.wait_for_timeout(400)

def close_panel(page):
    page.keyboard.press('Escape'); page.wait_for_timeout(250)

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 760})
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.goto(URL)
    page.wait_for_selector('text=WELCOME TO FIN', timeout=20000)
    page.screenshot(path=f'{OUT}/01-start.png')
    check('guest start screen, no login required', page.is_visible('text=Play now') and page.is_visible('text=no sign-up'))
    page.fill('#g-name', 'Tester'); page.click('text=Play now')
    page.wait_for_selector('[data-go]', timeout=40000)
    check('welcome shows ₹10,00,000 virtual', page.is_visible('text=₹10,00,000'))
    page.click('[data-go]'); page.wait_for_timeout(2500)
    page.screenshot(path=f'{OUT}/02-spawn.png')
    # Software rendering in CI is slow; Low graphics keeps the simulation close to real time for timing checks.
    page.evaluate('window.__finworld._applySettings({ graphics: "low" })'); page.wait_for_timeout(1500)
    s0 = snap(page)
    check('renderer drawing the bigger city', s0['calls'] > 10, f"calls={s0['calls']} tris={s0['triangles']}")
    check('21 NPCs present', len(s0['npcs']) == 21)

    page.click('#world', position={'x': 640, 'y': 600})
    hold(page, 'w', 2500)
    s1 = snap(page)
    check('W moves the player', math.hypot(s1['player']['x'] - s0['player']['x'], s1['player']['z'] - s0['player']['z']) > 2)

    # cars move along roads
    c0 = snap(page)['cars']; page.wait_for_timeout(5000); c1 = snap(page)['cars']
    moved = sum(1 for a, b in zip(c0, c1) if math.hypot(a['x'] - b['x'], a['z'] - b['z']) > 2)
    check('cars drive', moved >= len(c0) // 2, f'{moved}/{len(c0)} moved')
    on_road = all(min(abs(c['x'] - r) for r in ROADS) < 4.5 or min(abs(c['z'] - r) for r in ROADS) < 4.5 for c in c1)
    check('cars stay on roads', on_road)
    # a car stops for the player standing in its lane
    stopped = page.evaluate("""(() => { const g = window.__finworld; const c = g.traffic.cars[0];
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        g.player.place(c.pos.x + fx * 6, c.pos.z + fz * 6); return true; })()""")
    sp = 99
    for _ in range(10):
        page.wait_for_timeout(500); sp = min(sp, page.evaluate('window.__finworld.traffic.cars[0].speed'))
    check('car brakes for the player', sp < 0.6, f'speed={sp:.2f}')
    page.evaluate("(() => { const g = window.__finworld; const c = g.traffic.cars[0]; g.player.place(c.pos.x + 30, c.pos.z + 30); })()")
    page.evaluate("window.__finworld.player.place(-10, -22, 0)")
    page.wait_for_timeout(1200)
    page.screenshot(path=f'{OUT}/03-street-traffic.png')

    # Mouse look: one click captures the pointer, then plain mouse movement turns the camera
    page.click('#world', position={'x': 640, 'y': 400}); page.wait_for_timeout(200)
    yaw0 = page.evaluate('window.__finworld.cam.yaw')
    page.evaluate("for (let i = 0; i < 10; i++) document.dispatchEvent(new MouseEvent('mousemove', { movementX: 20, movementY: 0 }))"); page.wait_for_timeout(300)
    yaw1 = page.evaluate('window.__finworld.cam.yaw')
    check('mouse moves the camera without dragging', page.evaluate('window.__finworld.input.locked') and abs(yaw1 - yaw0) > 0.2, f'{yaw0:.2f}->{yaw1:.2f}')
    page.keyboard.press('Escape'); page.evaluate('document.exitPointerLock()'); page.wait_for_timeout(300)
    check('Esc frees the cursor without opening the menu', not page.evaluate('window.__finworld.input.locked') and not page.is_visible('.menu-tabs'))
    # Parth and Aanya stand together at the fountain
    pa = page.evaluate("(() => { const g = window.__finworld; const a = g.npcs.byId('financial-expert').pos, b = g.npcs.byId('fund-manager').pos; return [a.x, a.z, b.x, b.z]; })()")
    check('Parth and Aanya together in the centre', math.hypot(pa[0] - pa[2], pa[1] - pa[3]) < 3.5 and math.hypot(pa[0], pa[1]) < 9, json.dumps(pa))
    page.evaluate("(() => { const g = window.__finworld; g.player.place(0, -10.5, 0); g.cam.snapBehind(Math.PI); g.cam.pitch = 0.2; })()"); page.wait_for_timeout(1200)
    page.screenshot(path=f'{OUT}/02b-parth-aanya.png')
    # Up arrow opens the phone, Down arrow closes it
    page.keyboard.press('ArrowUp'); page.wait_for_timeout(300)
    check('Up arrow opens the phone', page.is_visible('.phone'))
    page.keyboard.press('ArrowDown'); page.wait_for_timeout(300)
    check('Down arrow closes the phone', not page.is_visible('.phone'))
    # GPS route along the roads
    page.evaluate("window.__finworld.goTo('accofintra-hq')"); page.wait_for_timeout(1500)
    rl = page.evaluate('window.__finworld.gps.route ? window.__finworld.gps.route.length : 0')
    check('GPS draws a road route to the waypoint', rl >= 3 and page.evaluate('window.__finworld.gps.mesh.visible'), f'{rl} points')
    page.evaluate("(() => { const g = window.__finworld; g.player.place(25 - 4.3, 10, Math.PI); g.cam.snapBehind(Math.PI); g.cam.pitch = 0.45; g.cam.targetDistance = 11; })()"); page.wait_for_timeout(1800)
    page.screenshot(path=f'{OUT}/02c-gps.png')
    page.evaluate('window.__finworld.waypoint = null'); page.wait_for_timeout(200)

    # Drive the player's car
    page.evaluate("(() => { const g = window.__finworld; g.player.place(g.car.pos.x - 2.3, g.car.pos.z, 0); })()")
    page.wait_for_timeout(300)
    check('prompt to drive own car', snap(page)['target'] == 'Drive your car')
    page.keyboard.press('e'); page.wait_for_timeout(300)
    c0 = snap(page)['myCar']
    hold(page, 'w', 1500)
    page.keyboard.down('d'); hold(page, 'w', 2000); page.keyboard.up('d')
    c1 = snap(page)['myCar']
    check('driver sits visibly in the car', page.evaluate('window.__finworld.player.object.parent === window.__finworld.car.mesh && window.__finworld.player.object.visible'))
    check('car drives and turns', c1['driving'] and math.hypot(c1['x'] - c0['x'], c1['z'] - c0['z']) > 8 and abs(c1['heading'] - c0['heading']) > 0.2, json.dumps(c1))
    page.screenshot(path=f'{OUT}/03b-driving.png')
    hold(page, 'Space', 1800)
    page.keyboard.press('e'); page.wait_for_timeout(300)
    check('get out of the car', not snap(page)['myCar']['driving'] and page.evaluate('window.__finworld.player.object.visible'))
    # crash test: drive into the Bank wall
    page.evaluate("(() => { const g = window.__finworld; g.car.pos.x = -30; g.car.pos.z = 4; g.car.heading = -Math.PI/2; g.player.place(-30, 1.5, 0); g._enterCar(); })()")
    page.wait_for_timeout(200)
    hold(page, 'w', 6000)
    cx = snap(page)['myCar']['x']
    check('car cannot drive through a building', -39.5 + 1.8 < cx < -33, f'x={cx:.2f}')
    hold(page, 'Space', 1500); page.evaluate('window.__finworld._exitCar()'); page.wait_for_timeout(200)

    # Stock Exchange: buy shares
    go_door(page, 'stock-exchange')
    page.keyboard.press('e'); page.wait_for_selector('.panel', timeout=4000); page.wait_for_timeout(400)
    cash0 = snap(page)['cash']
    page.fill('#qty', '10'); page.click('[data-buy]'); page.wait_for_timeout(300)
    cash1 = snap(page)['cash']
    check('buy 10 shares reduces virtual cash', cash1 < cash0, f'{cash0:.0f} -> {cash1:.0f}')
    page.screenshot(path=f'{OUT}/04-exchange-trade.png')
    page.click('text=Trade ETFs'); page.wait_for_timeout(200)
    check('ETF tab works', page.is_visible('text=FINVORA Gold ETF'))
    close_panel(page)

    # Mutual funds: invest + SIP
    go_door(page, 'mutual-fund')
    page.keyboard.press('e'); page.wait_for_selector('.panel'); page.wait_for_timeout(300)
    page.fill('#amt', '25000'); page.click('[data-buy]'); page.wait_for_timeout(200)
    page.click('.menu-tabs >> text=SIPs'); page.wait_for_timeout(200)
    page.fill('#s-amt', '5000'); page.click('[data-start]'); page.wait_for_timeout(200)
    check('SIP started', page.is_visible('text=Your SIPs') and page.locator('[data-stop]').count() == 1)
    page.screenshot(path=f'{OUT}/05-mf-sip.png')
    close_panel(page)

    # Bank: FD + interest wall maths
    go_door(page, 'bank')
    page.keyboard.press('e'); page.wait_for_selector('.panel'); page.wait_for_timeout(300)
    page.click('.menu-tabs >> text=FDs and RDs'); page.wait_for_timeout(200)
    page.click('[data-fd]'); page.wait_for_timeout(200)
    check('FD opened', page.is_visible('text=FD 12 m'))
    page.click('.menu-tabs >> text=Interest Wall'); page.wait_for_timeout(200)
    page.evaluate("(() => { const s = (id, v) => { const i = document.querySelector(id); i.value = v; i.dispatchEvent(new Event('input')); }; s('#iw-y', 20); s('#iw-r', 10); s('#iw-n', 1); })()")
    txt = page.inner_text('[data-c]').replace(' ', '')
    check('interest wall: ₹1L @10% yearly 20y = ₹6,72,750', txt == '₹6,72,750', txt)
    page.click('.menu-tabs >> text=EMI / Loan Calculator'); page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/06-bank-emi.png')
    close_panel(page)

    # Government Savings Office: PPF
    go_door(page, 'govt-savings')
    page.keyboard.press('e'); page.wait_for_selector('.panel'); page.wait_for_timeout(300)
    page.fill('#ppf', '50000'); page.click('[data-ppf]'); page.wait_for_timeout(200)
    check('PPF deposit made', page.is_visible('text=Balance ₹50,000'))
    page.screenshot(path=f'{OUT}/07-govt-schemes.png')
    close_panel(page)

    # Calculator Centre
    go_door(page, 'calc-centre')
    page.keyboard.press('e'); page.wait_for_selector('.panel'); page.wait_for_timeout(300)
    page.click('[data-c="retirement"]'); page.wait_for_timeout(300)
    check('calculator centre opens a calculator', page.is_visible('text=Corpus needed at 60'))
    page.screenshot(path=f'{OUT}/08-calculators.png')
    close_panel(page)

    # Portfolio + time travel
    page.keyboard.press('p'); page.wait_for_selector('text=My Portfolio')
    page.click('.menu-tabs >> text=Time'); page.click('[data-adv="30"]'); page.wait_for_timeout(400)
    page.click('.menu-tabs >> text=Overview'); page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/09-portfolio.png')
    sd = snap(page)['simDate']
    check('fast-forward one month moves the sim date', sd >= '2026-05-01', sd)
    page.click('.menu-tabs >> text=Transactions'); page.wait_for_timeout(200)
    check('SIP instalment ran during the skipped month', page.locator('text=AccoFinTra Index Fund').count() >= 1 and page.locator('td >> text=/SIP|AccoFinTra/').count() >= 2)
    check('ledger says entries cannot be edited', page.is_visible('text=can never be edited or deleted'))
    page.screenshot(path=f'{OUT}/10-transactions.png')
    close_panel(page)

    # Helper agent: typed question with referral
    page.evaluate("""(() => { const g = window.__finworld; const n = g.npcs.byId('mf-advisor');
        g.player.place(n.pos.x + 1.4, n.pos.z, -Math.PI/2); })()""")
    page.wait_for_timeout(300)
    page.keyboard.press('e'); page.wait_for_selector('.dlg')
    page.fill('.dlg-ask input', 'How is my EMI calculated?'); page.keyboard.press('Enter'); page.wait_for_timeout(300)
    check("agent answers and refers to the Loan Officer", page.is_visible("text=really Rydham's area") and page.is_visible('text=Show me where'))
    page.screenshot(path=f'{OUT}/11-agent-ask.png')
    page.click('[data-find]'); page.wait_for_timeout(300)
    check('find-agent sets a live waypoint', page.is_visible('text=Rydham ·'))
    close_panel(page)

    # The leader answers anything without handing off
    page.evaluate("""(() => { const g = window.__finworld; const n = g.npcs.byId('financial-expert');
        g.player.place(n.pos.x + 1.4, n.pos.z, -Math.PI/2); g._interact({ kind: 'npc', npc: n }); })()""")
    page.wait_for_selector('.dlg')
    page.fill('.dlg-ask input', 'What is a SIP?'); page.keyboard.press('Enter'); page.wait_for_timeout(300)
    check('Parth answers any topic directly', page.is_visible('text=Parth') and not page.is_visible("text=really") and page.is_visible('text=Go deeper with Altamash'))
    page.screenshot(path=f'{OUT}/11b-parth.png')
    close_panel(page)

    # Style Studio: buy and wear clothes
    go_door(page, 'clothing-store')
    page.evaluate("(() => { const g = window.__finworld; g.panels.close(); g.dialogue.close(); g.openBuilding(g.city.doors.find(d => d.building.id === 'clothing-store').building); })()")
    page.wait_for_selector('.panel'); page.wait_for_timeout(300)
    page.locator('[data-buy="suit"]').click(); page.wait_for_timeout(200)
    page.locator('[data-buy="glasses"]').click(); page.wait_for_timeout(200)
    eq = page.evaluate('window.__finworld.state.avatar.equipped')
    check('buy clothes equips them', 'top' in eq and 'glasses' in eq, json.dumps(eq))
    page.screenshot(path=f'{OUT}/14-style-studio.png')
    close_panel(page)

    # Car showroom: loan purchase
    go_door(page, 'car-showroom')
    page.evaluate("(() => { const g = window.__finworld; g.panels.close(); g.dialogue.close(); g.openBuilding(g.city.doors.find(d => d.building.id === 'car-showroom').building); })()")
    page.wait_for_selector('.panel'); page.wait_for_timeout(300)
    page.click('[data-car="volt"]'); page.wait_for_timeout(150)
    page.click('[data-mode="loan"]'); page.wait_for_timeout(150)
    page.screenshot(path=f'{OUT}/15-showroom.png')
    page.click('[data-buy]'); page.wait_for_timeout(300)
    act_car = page.evaluate('window.__finworld.car.catalogId')
    page.click('[data-car="scoot"]'); page.wait_for_timeout(150); page.click('[data-mode="full"]'); page.wait_for_timeout(100); page.click('[data-buy]'); page.wait_for_timeout(300)
    page.evaluate("(() => { const g = window.__finworld; g.panels.close(); g._enterCar(); })()"); page.wait_for_timeout(400)
    page.evaluate("(() => { const g = window.__finworld; g.cam.yaw = g.car.heading + 2.3; g.cam.pitch = 0.25; g.cam.targetDistance = 4.5; })()"); page.wait_for_timeout(1200)
    page.screenshot(path=f'{OUT}/15b-scooter-rider.png')
    check('riding the scooter shows the rider', page.evaluate("window.__finworld.car.rider === 'scooter' && window.__finworld.player.char.seated === 'ride'"))
    page.evaluate("(() => { const g = window.__finworld; g._exitCar(); g.useCar(g.fin.garage.find(c => c.catalogId === 'volt').id); g.openBuilding(g.city.doors.find(d => d.building.id === 'car-showroom').building); })()"); page.wait_for_timeout(300)
    check('buy an EV on a car loan; it becomes the active car', act_car == 'volt' and page.evaluate("window.__finworld.fin.loans.some(l => l.kind === 'car')"))
    close_panel(page)

    # Phone
    page.keyboard.press('t'); page.wait_for_selector('.phone')
    page.screenshot(path=f'{OUT}/16-phone-home.png')
    page.click('[data-app="avatar"]'); page.wait_for_timeout(200)
    page.click('[data-hs="long"]'); page.wait_for_timeout(600)
    check('avatar editor changes hairstyle', page.evaluate("window.__finworld.state.avatar.hairStyle") == 'long')
    page.screenshot(path=f'{OUT}/17-phone-avatar.png')
    page.click('[data-home]'); page.click('[data-app="garage"]'); page.wait_for_timeout(200)
    check('garage lists owned vehicles', page.locator('.phone .card-in').count() == 3)
    volt_id = page.evaluate("window.__finworld.fin.garage.find(c => c.catalogId === 'volt').id")
    page.locator(f'[data-summon="{volt_id}"]').click(); page.wait_for_timeout(300)
    pp = snap(page)['player']; mc = snap(page)['myCar']
    check('summon brings the car next to you', math.hypot(pp['x'] - mc['x'], pp['z'] - mc['z']) < 6, f"{pp['x']:.1f},{pp['z']:.1f} vs {mc['x']:.1f},{mc['z']:.1f}")
    page.evaluate('window.__finworld._advanceSim(35)'); page.wait_for_timeout(200)
    page.keyboard.press('t'); page.wait_for_selector('.phone'); page.click('[data-app="messages"]'); page.wait_for_timeout(200)
    check('agents text you after a month (SIP, EMI, fuel)', page.locator('.phone .msg').count() >= 3, str(page.locator('.phone .msg').count()))
    page.screenshot(path=f'{OUT}/18-phone-messages.png')
    page.click('[data-home]'); page.click('[data-app="contacts"]'); page.wait_for_timeout(200)
    page.click('[data-call="tax-consultant"]'); page.wait_for_selector('.dlg')
    check('call an agent from the phone', page.is_visible('text=on call'))
    page.keyboard.press('Escape'); page.wait_for_timeout(200)

    # Round 7: Academy course, Job Centre, salary, Credit Bureau, fuel station, Tax Office
    go_door(page, 'academy'); page.keyboard.press('e'); page.wait_for_selector('.panel', timeout=4000); page.wait_for_timeout(300)
    page.click('[data-open="money"]'); page.wait_for_timeout(150)
    for qi in range(5): page.click(f'[data-q="{qi}:0"]'); page.wait_for_timeout(60)
    page.click('[data-submit]'); page.wait_for_timeout(300)
    check('Academy quiz awards a certificate', page.evaluate("!!window.__finworld.fin.life.certs.money"))
    close_panel(page)
    go_door(page, 'job-centre'); page.keyboard.press('e'); page.wait_for_selector('.panel', timeout=4000); page.wait_for_timeout(300)
    page.click('[data-job="developer"]'); page.wait_for_timeout(300)
    check('Job Centre hires you', page.evaluate("window.__finworld.fin.life.job && window.__finworld.fin.life.job.id") == 'developer')
    page.screenshot(path=f'{OUT}/16b-job-centre.png')
    close_panel(page)
    page.evaluate('window.__finworld._advanceSim(35)'); page.wait_for_timeout(300)
    check('salary is credited at month end', page.evaluate("window.__finworld.fin.ledger.some(e => e.type === 'salary')"))
    go_door(page, 'credit-bureau'); page.keyboard.press('e'); page.wait_for_selector('.panel', timeout=4000); page.wait_for_timeout(300)
    check('Credit Bureau shows a report', page.is_visible('text=Accounts on your report'))
    close_panel(page)
    page.evaluate("(() => { const g = window.__finworld; const fs = g.city.fuelStation; g._parkCarAt(fs.x, fs.z + 4, 0); g.fin.garage.find(c => c.id === g.state.activeCar).fuel = 0.2; })()"); page.wait_for_timeout(200)
    go_door(page, 'fuel-station'); page.keyboard.press('e'); page.wait_for_selector('.panel', timeout=4000); page.wait_for_timeout(300)
    page.click('[data-full]'); page.wait_for_timeout(300)
    check('fuel station fills the tank', page.evaluate("window.__finworld.fin.carFuel(window.__finworld.state.activeCar)") > 0.99)
    page.screenshot(path=f'{OUT}/16c-fuel.png')
    close_panel(page)
    go_door(page, 'tax-office'); page.keyboard.press('e'); page.wait_for_selector('.panel', timeout=4000); page.wait_for_timeout(300)
    check('Tax Office compares both regimes', page.is_visible('text=New regime') and page.is_visible('text=Old regime'))
    close_panel(page)
    page.evaluate("(() => { const g = window.__finworld; g.player.place(0, -118, Math.PI); g.cam.snapBehind(Math.PI); g.cam.pitch = -0.35; g.cam.targetDistance = 8; })()"); page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/16d-tower-logo.png')

    # Save + restore including finance
    page.evaluate('window.__finworld._persist({ immediate: true }); window.__finworld._saveFinance(true)')
    page.wait_for_timeout(800)
    led = snap(page)['ledger']
    page.reload()
    page.wait_for_selector('text=Play now'); page.click('text=Play now')
    page.wait_for_function('window.__finworld', timeout=40000); page.wait_for_timeout(1200)
    r = snap(page)
    check('finance restored after reload (same ledger, no second welcome)', r['ledger'] == led and not page.is_visible('[data-go]'), f"ledger {led} -> {r['ledger']}")
    check('avatar, wardrobe and garage restored', page.evaluate("window.__finworld.car.catalogId") == 'volt' and page.evaluate("window.__finworld.state.avatar.hairStyle") == 'long' and len(page.evaluate("window.__finworld.fin.wardrobe")) == 2, page.evaluate('window.__finworld.car.catalogId'))
    # night view
    page.evaluate('window.__finworld.state.clockHour = 20.5; window.__finworld.clock.t = 0; window.__finworld.player.place(-30, 22, 2.4); window.__finworld.cam.snapBehind(2.4); window.__finworld.cam.pitch = 0.25;')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/12-night.png')
    page.keyboard.press('m'); page.wait_for_selector('.map-wrap'); page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/13-map.png')
    ctx.close()

    # ------------------------------------------------------------------ mobile
    m = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    mp = m.new_page()
    mp.on('pageerror', lambda e: errors.append(f'mobile pageerror: {e}'))
    start(mp)
    mp.screenshot(path=f'{OUT}/20-mobile-welcome.png')
    mp.click('[data-go]'); mp.wait_for_timeout(1500)
    check('mobile defaults to Low graphics', mp.evaluate('window.__finworld.state.settings.graphics') == 'low')
    s0 = snap(mp)
    cdp = m.new_cdp_session(mp)
    def touch(t, pts): cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(pts)]})
    touch('touchStart', [(90, 720)])
    for k in range(1, 8): touch('touchMove', [(90, 720 - k * 7)]); mp.wait_for_timeout(30)
    mp.wait_for_timeout(1500); touch('touchEnd', [])
    s1 = snap(mp)
    check('virtual joystick moves player', math.hypot(s1['player']['x'] - s0['player']['x'], s1['player']['z'] - s0['player']['z']) > 1.5)
    y0 = mp.evaluate('window.__finworld.cam.yaw')
    touch('touchStart', [(300, 400)])
    for k in range(1, 8): touch('touchMove', [(300 - k * 12, 400)]); mp.wait_for_timeout(20)
    touch('touchEnd', [])
    check('touch drag rotates camera', abs(mp.evaluate('window.__finworld.cam.yaw') - y0) > 0.3)
    mp.screenshot(path=f'{OUT}/21-mobile-play.png')
    go_door(mp, 'stock-exchange')
    mp.tap('[data-a="interact"]'); mp.wait_for_selector('.panel'); mp.wait_for_timeout(400)
    mp.screenshot(path=f'{OUT}/22-mobile-exchange.png')
    check('ENTER button opens the Exchange on touch', mp.is_visible('text=Trade shares'))
    mp.tap('[data-buy]'); mp.wait_for_timeout(200)
    check('trade from phone', snap(mp)['cash'] < 1000000)
    mp.tap('.close-x'); mp.wait_for_timeout(200)
    mp.tap('[data-portfolio]'); mp.wait_for_selector('text=My Portfolio'); mp.wait_for_timeout(300)
    mp.screenshot(path=f'{OUT}/23-mobile-portfolio.png')
    check('no horizontal overflow on 390px', not mp.evaluate('document.documentElement.scrollWidth > window.innerWidth'))
    mp.tap('.close-x'); mp.wait_for_timeout(200)
    mp.evaluate("""(() => { const g = window.__finworld; const n = g.npcs.byId('savings-agent'); g.player.place(n.pos.x + 1.4, n.pos.z, -Math.PI/2); })()""")
    mp.wait_for_timeout(300); mp.tap('[data-a="interact"]'); mp.wait_for_selector('.dlg'); mp.wait_for_timeout(200)
    mp.screenshot(path=f'{OUT}/24-mobile-agent.png')
    check('helper agent dialogue on phone', mp.is_visible('.dlg-ask'))
    mp.tap('.dlg .close-x'); mp.wait_for_timeout(200)
    mp.tap('[data-phone]'); mp.wait_for_selector('.phone'); mp.wait_for_timeout(300)
    mp.screenshot(path=f'{OUT}/26-mobile-phone.png')
    check('phone opens on mobile', mp.is_visible('text=Contacts'))
    mp.tap('.phone .close-x'); mp.wait_for_timeout(200)
    mp.evaluate("(() => { const g = window.__finworld; g.player.place(0, 14, Math.PI); })()")
    mp.tap('.dlg .close-x') if mp.is_visible('.dlg') else None
    mp.wait_for_timeout(200)
    mp.evaluate("(() => { const g = window.__finworld; g.car.pos.x = 23.5; g.car.pos.z = 40; g.car.heading = 0; g.car._sync(); g.player.place(21.2, 40, 0); })()")
    mp.wait_for_timeout(300)
    check('DRIVE button on phone', mp.inner_text('[data-a="interact"]') == 'DRIVE')
    mp.tap('[data-a="interact"]'); mp.wait_for_timeout(300)
    p0 = snap(mp)['myCar']
    touch('touchStart', [(90, 720)])
    for k in range(1, 8): touch('touchMove', [(90, 720 - k * 7)]); mp.wait_for_timeout(30)
    mp.wait_for_timeout(2000); touch('touchEnd', [])
    p1 = snap(mp)['myCar']
    check('joystick drives the car on phone', p1['driving'] and math.hypot(p1['x'] - p0['x'], p1['z'] - p0['z']) > 5)
    mp.screenshot(path=f'{OUT}/25-mobile-driving.png')
    m.close()
    browser.close()

print('\nERRORS:', *errors[:20], sep='\n  ') if errors else print('\nNo page errors.')
failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
sys.exit(1 if failed or any('pageerror' in e for e in errors) else 0)
