/*

설명
block은 거래 기록 단위
node는 사용자 (장부의 수)

작동방식
1. 블록 생성
Node가 새로운 블록을 생성
새 블록의 previousHash = Node 체인의 마지막 블록 헤시
2. 자신의 Node 체인에 추가
Genisis Block의 chain에 생성한 블록 추가
3. 동기화
다른 Node에 블록을 전파
받은 Node는 동기화 여부 검사 이후 chain 끝에 블록을 추가 (변조 검사)
4. 모든 네트워크 동일 원장 유지

*/

class Block {
    constructor(index, previousHash, transaction, timestamp = Date.now()) {
        this.index = index;
        this.previousHash = previousHash;
        this.transaction = transaction;
        this.timestamp = timestamp;
        this.hash = this.generateHash();
    }

    generateHash() {
        return btoa(
            this.index +
                this.previousHash +
                JSON.stringify(this.transaction) +
                this.timestamp
        );
    }
}

class User {
    constructor(username, password, amount) {
        this.username = username;
        this.password = password;
        this.amount = amount;
    }

    transfer(from, to, amount) {
        // UserDB에서 사용자 존재 여부 확인
        if (!userDB.userExists(from)) {
            console.log(`❌ [거래 실패] 송신자 '${from}'이 존재하지 않습니다.`);
            return false;
        }

        if (!userDB.userExists(to)) {
            console.log(`❌ [거래 실패] 수신자 '${to}'이 존재하지 않습니다.`);
            return false;
        }

        // 송신자의 잔액 확인
        const senderBalance = userDB.getBalance(from);
        if (senderBalance < amount) {
            console.log(`❌ [거래 실패] '${from}'의 잔액이 부족합니다. (현재: ${senderBalance}원, 필요: ${amount}원)`);
            return false;
        }

        // 거래 객체 생성
        const tx = {
            from: `${from}`,
            to: `${to}`,
            amount: amount,
        }

        try {
            const newBlock = nodeA.addBlock(tx);
            // Use visualization broadcast handled in UI when used
            network.broadcast(newBlock, nodeA);

            // 잔액 업데이트
            userDB.updateBalance(from, -amount);
            userDB.updateBalance(to, amount);

            console.log(`✅ [거래 성공] ${from} → ${to} (${amount}원)`);
            
            // 각 노드의 체인 상태를 보기 좋게 출력
            console.log("\n========== 네트워크 현황 ==========");
            printNodeChain("Node A", nodeA);
            printNodeChain("Node B", nodeB);
            printNodeChain("Node C", nodeC);
            console.log("==================================\n");
            return true;
        } catch (error) {
            console.log(`❌ [거래 실패] ${error.message}`);
            return false;
        }
    }
}

// 사용자 관리 DB 클래스
class UserDB {
    constructor() {
        this.users = {}; // { username: { password, balance } }
    }

    // 새 사용자 등록
    registerUser(username, password, initialBalance = 0) {
        if (this.users[username]) {
            return false;
        }

        this.users[username] = {
            password: password,
            balance: initialBalance
        };

        console.log(`✅ 사용자 '${username}'이 등록되었습니다. (초기 잔액: ${initialBalance}원)`);
        return true;
    }

    // 사용자 존재 여부 확인
    userExists(username) {
        return this.users.hasOwnProperty(username);
    }

    // 사용자 잔액 조회
    getBalance(username) {
        if (!this.userExists(username)) {
            console.log(`❌ 사용자 '${username}'이 존재하지 않습니다.`);
            return -1;
        }
        return this.users[username].balance;
    }

    // 사용자 잔액 업데이트
    updateBalance(username, amount) {
        if (!this.userExists(username)) {
            return false;
        }

        this.users[username].balance += amount;
        return true;
    }

    // 모든 사용자의 잔액 조회
    getAllBalances() {
        const balances = {};
        for (const [username, data] of Object.entries(this.users)) {
            balances[username] = data.balance;
        }
        return balances;
    }

    // 사용자 목록 조회
    getAllUsers() {
        return Object.keys(this.users);
    }
}

class Node {
    constructor(name) {
        this.name = name;
        this.chain = [this.createGenesisBlock()];
        this.hash = this.generateHash();
    }

    // hash 생성 함수 (변할 수 있음.)
    generateHash() {
        const data =
            this.previousHash +
            JSON.stringify(this.transactions) +
            this.timestamp;

        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = (hash << 5) - hash + data.charCodeAt(i);
            hash |= 0; // 32bit 정수 유지
        }
        return hash.toString();
    }

    // Genesis Block 생성
    createGenesisBlock() {
        return new Block(0, "0", []);
    }

    getLastestBlock() {
        return this.chain[this.chain.length - 1];
    }

    // 거래 유효 검사 및 블록 추가
    addBlock(transaction) {
        // 거래 유효 검사
        const validationResult = this.isValidTransaction(transaction);
        if (!validationResult.valid) {
            throw new Error(validationResult.message);
        }

        /* Node의 chain에 생성 블록 추가 */
        const previousHash = this.getLastestBlock().hash;
        const newBlock = new Block(
            this.chain.length,
            previousHash,
            transaction
        );
        this.chain.push(newBlock);
        return newBlock;
    }

    isValidTransaction(transaction) {
        // 필수 필드 확인
        if (!transaction.from || !transaction.to || transaction.amount === undefined) {
            return { 
                valid: false, 
                message: "거래에 필수 필드(from, to, amount)가 누락되었습니다." 
            };
        }

        // 송신자와 수신자가 같은지 확인
        if (transaction.from === transaction.to) {
            return { 
                valid: false, 
                message: "송신자와 수신자가 동일할 수 없습니다." 
            };
        }

        // 금액이 양수인지 확인
        if (transaction.amount <= 0) {
            return { 
                valid: false, 
                message: "거래 금액은 0보다 커야 합니다." 
            };
        }

        if (typeof transaction.amount !== 'number') {
            return { 
                valid: false, 
                message: "거래 금액은 숫자 형식이어야 합니다." 
            };
        }

        // 주소가 빈 문자열이 아닌지 확인
        if (typeof transaction.from !== 'string' || typeof transaction.to !== 'string') {
            return { 
                valid: false, 
                message: "송신자와 수신자는 문자열이어야 합니다." 
            };
        }

        if (transaction.from.trim() === '' || transaction.to.trim() === '') {
            return { 
                valid: false, 
                message: "송신자와 수신자는 공백일 수 없습니다." 
            };
        }

        return { valid: true };
    }

    // 동기화 및 검사
    syncBlock(block) {
        if (block.previousHash === this.getLastestBlock().hash) {
            this.chain.push(block);
            return true;
        }
        return false;
    }
}

class Network {
    constructor(nodes) {
        this.nodes = nodes;
    }

    broadcast(block, originNode) {
        // Deprecated for UI visualization; keep synchronous fallback
        this.nodes.forEach((node) => {
            if (node !== originNode) node.syncBlock(block);
        });
    }
}

// 노드의 체인을 보기 좋게 출력하는 함수
function printNodeChain(nodeName, node) {
    console.log(`\n[${nodeName}] 체인 상태:`);
    console.log(`체인 길이: ${node.chain.length}개 블록`);
    
    node.chain.forEach((block, index) => {
        if (index === 0) {
            console.log(`  └─ [Genesis Block] (초기 블록)`);
        } else {
            const tx = block.transaction;
            console.log(`  └─ [Block ${index}] ${tx.from} → ${tx.to} (${tx.amount}원)`);
        }
    });
}

// 첫 블록 (더미 역할)
const Genesis_Block = new Node("Genesis Block");

const nodeA = new Node("A");
const nodeB = new Node("B");
const nodeC = new Node("C");

// network 형성
const network = new Network([nodeA, nodeB, nodeC]);

// UserDB 생성
const userDB = new UserDB();

// UI helpers
const simulator = document.getElementById('simulator');
const centerMessage = document.getElementById('centerMessage');
const modal = document.getElementById('modal');
const addUserBtn = document.getElementById('addUserBtn');
const createUserBtn = document.getElementById('createUserBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const newUserName = document.getElementById('newUserName');
const newUserAmount = document.getElementById('newUserAmount');
const detailsPanel = document.getElementById('detailsPanel');
const detailNameText = document.getElementById('detailNameText');
const detailBalanceText = document.getElementById('detailBalanceText');
const renameBtn = document.getElementById('renameBtn');
const changeBalanceBtn = document.getElementById('changeBalanceBtn');
const deleteUserBtn = document.getElementById('deleteUserBtn');
// close button removed from details panel (UI simplified)
const txFrom = document.getElementById('txFrom');
const txTo = document.getElementById('txTo');
const txOrigin = document.getElementById('txOrigin');
const txAmount = document.getElementById('txAmount');
const txForm = document.getElementById('txForm');
const userViewBtn = document.getElementById('userViewBtn');
const nodeViewBtn = document.getElementById('nodeViewBtn');
const linksSvg = document.getElementById('links');
const packetContainer = document.getElementById('packetContainer');

let selectedUser = null; // user name for details panel
let currentView = 'user'; // 'user' or 'node'

function showCenterMessage(msg, timeout = 2500) {
    centerMessage.textContent = msg;
    centerMessage.classList.add('show');
    clearTimeout(centerMessage._timer);
    centerMessage._timer = setTimeout(() => {
        centerMessage.classList.remove('show');
    }, timeout);
}

function createNodeElement(username) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.name = username;
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = username;
    const bal = document.createElement('div');
    bal.className = 'balance';
    bal.textContent = `${userDB.getBalance(username)} 원`;
    el.appendChild(name);
    el.appendChild(bal);
    el.addEventListener('click', () => openDetails(username));
    return el;
}

function createNetworkNodeElement(nodeObj) {
    const el = document.createElement('div');
    el.className = 'node';
    el.dataset.name = nodeObj.name;
    el.dataset.type = 'network';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = nodeObj.name;
    const bal = document.createElement('div');
    bal.className = 'balance';
    bal.textContent = `chain ${nodeObj.chain.length}`;
    el.appendChild(name);
    el.appendChild(bal);
    el.addEventListener('click', () => openDetails(nodeObj.name, true));
    return el;
}

function renderUsers() {
    // remove existing node elements
    Array.from(simulator.querySelectorAll('.node')).forEach(n => n.remove());
    const users = userDB.getAllUsers();
    users.slice(0,4).forEach((username) => {
        const nodeEl = createNodeElement(username);
        simulator.appendChild(nodeEl);
    });
    positionNodes();
    populateTxSelects();
}

function renderNodes() {
    Array.from(simulator.querySelectorAll('.node')).forEach(n => n.remove());
    network.nodes.forEach((n) => {
        const el = createNetworkNodeElement(n);
        simulator.appendChild(el);
    });
    positionNodes();
    drawLinks();
    populateTxSelects();
}

function positionNodes() {
    const nodes = Array.from(simulator.querySelectorAll('.node'));
    const rect = simulator.getBoundingClientRect();
    const centerX = rect.width/2;
    const centerY = rect.height/2;
    const layouts = {
        0: [],
        1: [{x:0,y:0}],
        2: [{x:-180,y:0},{x:180,y:0}],
        3: [{x:0,y:-110},{x:-140,y:80},{x:140,y:80}],
        4: [{x:-140,y:-90},{x:140,y:-90},{x:-140,y:90},{x:140,y:90}]
    };
    const pos = layouts[nodes.length] || layouts[4];
    nodes.forEach((el, i) => {
        const p = pos[i] || {x:0,y:0};
        // center origin; use transform for animation
        el.style.left = `${centerX}px`;
        el.style.top = `${centerY}px`;
        el.style.transform = `translate(${p.x}px, ${p.y}px)`;
        // update balance text
        const bal = el.querySelector('.balance');
        if (el.dataset.type === 'network') {
            const nodeObj = getNodeByName(el.dataset.name);
            bal.textContent = `chain ${nodeObj.chain.length}`;
        } else {
            bal.textContent = `${userDB.getBalance(el.dataset.name)} 원`;
        }
    });
}

function drawLinks() {
    // draw persistent thin gray lines between visible nodes (network view)
    linksSvg.innerHTML = '';
    const nodes = Array.from(simulator.querySelectorAll('.node'));
    if (!nodes.length) return;
    const rect = simulator.getBoundingClientRect();
    linksSvg.setAttribute('width', rect.width);
    linksSvg.setAttribute('height', rect.height);
    nodes.forEach((a, i) => {
        const ra = a.getBoundingClientRect();
        const ax = ra.left - rect.left + ra.width/2;
        const ay = ra.top - rect.top + ra.height/2;
        for (let j = i+1; j < nodes.length; j++) {
            const b = nodes[j];
            const rb = b.getBoundingClientRect();
            const bx = rb.left - rect.left + rb.width/2;
            const by = rb.top - rect.top + rb.height/2;
            const line = document.createElementNS('http://www.w3.org/2000/svg','line');
            line.setAttribute('x1', ax);
            line.setAttribute('y1', ay);
            line.setAttribute('x2', bx);
            line.setAttribute('y2', by);
            // store endpoints so we can find this line later
            line.dataset.src = a.dataset.name;
            line.dataset.dst = b.dataset.name;
            line.setAttribute('stroke','#d0d4d8');
            line.setAttribute('stroke-width','1');
            linksSvg.appendChild(line);
        }
    });
}

function getNodeByName(name) {
    return network.nodes.find(n => n.name === name);
}

function animatePacket(originEl, targetEl, delay = 0) {
    return new Promise((resolve) => {
        const oRect = originEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        const simRect = simulator.getBoundingClientRect();
        const ox = oRect.left - simRect.left + oRect.width/2;
        const oy = oRect.top - simRect.top + oRect.height/2;
        const tx = tRect.left - simRect.left + tRect.width/2;
        const ty = tRect.top - simRect.top + tRect.height/2;
        const packet = document.createElement('div');
        packet.className = 'packet';
        packet.style.left = `${ox}px`;
        packet.style.top = `${oy}px`;
        packetContainer.appendChild(packet);
        // start after delay
        setTimeout(() => {
            // move using transform
            packet.style.transform = `translate(${tx-ox}px, ${ty-oy}px)`;
            packet.addEventListener('transitionend', () => {
                packet.style.opacity = '0';
                setTimeout(() => { packet.remove(); resolve(); }, 200);
            }, { once: true });
        }, delay);
    });
}

async function visualizeBroadcast(originName, block) {
    const originEl = simulator.querySelector(`.node[data-name="${originName}"]`);
    if (!originEl) return;
    const targets = Array.from(simulator.querySelectorAll('.node')).filter(el => el.dataset.name !== originName);
    // For each target, animate a packet and show processing, then sync
    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        // small delay for staggered packets
        // draw an active black path in the svg along which the packet travels
        const rect = simulator.getBoundingClientRect();
        const ra = originEl.getBoundingClientRect();
        const rb = target.getBoundingClientRect();
        const ax = ra.left - rect.left + ra.width/2;
        const ay = ra.top - rect.top + ra.height/2;
        const bx = rb.left - rect.left + rb.width/2;
        const by = rb.top - rect.top + rb.height/2;

        // find persistent line connecting origin and target and animate it
        let line = Array.from(linksSvg.querySelectorAll('line')).find(l => (l.dataset.src === originName && l.dataset.dst === target.dataset.name) || (l.dataset.src === target.dataset.name && l.dataset.dst === originName));
        if (line) {
            // briefly animate highlight
            line.classList.add('anim');
            // ensure packet animation runs while line is animating
            await animatePacket(originEl, target, i * 200);
        } else {
            // fallback: animate packet only
            await animatePacket(originEl, target, i * 200);
        }

        // show processing bubble on target
        const proc = document.createElement('div');
        proc.className = 'processing';
        proc.innerHTML = '검사 중 <span class="dots"></span>';
        const tRect = target.getBoundingClientRect();
        const simRect = simulator.getBoundingClientRect();
        // position processing badge below the node to avoid covering
        proc.style.left = `${tRect.left - simRect.left + tRect.width/2 - 18}px`;
        proc.style.top = `${tRect.top - simRect.top + tRect.height + 6}px`;
        packetContainer.appendChild(proc);

        // processing delay
        await new Promise(r => setTimeout(r, 700));

        // sync to network node if network node
        const nodeObj = getNodeByName(target.dataset.name);
        let ok = true;
        if (nodeObj) ok = nodeObj.syncBlock(block);

        proc.remove();

        // show status icon (check or X) for 2 seconds, positioned below node
        const status = document.createElement('div');
        status.className = `status-icon ${ok ? 'ok' : 'err'}`;
        status.textContent = ok ? '✓' : '✕';
        // position near target (below)
        status.style.left = `${tRect.left - simRect.left + tRect.width/2 - 14}px`;
        status.style.top = `${tRect.top - simRect.top + tRect.height + 6}px`;
        packetContainer.appendChild(status);
        setTimeout(() => { status.classList.add('hide'); setTimeout(()=>status.remove(), 350); }, 2000);

        // if synced, update UI text for that network node and persist line highlight
        if (target.dataset.type === 'network') {
            const nodeObj2 = getNodeByName(target.dataset.name);
            const bal = target.querySelector('.balance');
            bal.textContent = `chain ${nodeObj2.chain.length}`;
            // make the persistent line stay highlighted (find and keep class)
            if (line) line.classList.add('active-path');
        }

        // if the animation class was applied, remove anim after short delay
        if (line) setTimeout(()=>line.classList.remove('anim'), 600);

        // if details panel currently open for this node, refresh
        if (detailsPanel.getAttribute('aria-hidden') === 'false' && detailNameText.textContent === target.dataset.name) {
            openDetails(target.dataset.name, target.dataset.type === 'network');
        }
    }
    // after all packets, redraw links (visual polish)
    drawLinks();
}

function populateTxSelects() {
    [txFrom, txTo].forEach(sel => {
        sel.innerHTML = '';
        userDB.getAllUsers().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            sel.appendChild(opt);
        });
    });
    // origin select: available network nodes
    if (txOrigin) {
        txOrigin.innerHTML = '';
        network.nodes.forEach(n => {
            const opt = document.createElement('option'); opt.value = n.name; opt.textContent = n.name;
            txOrigin.appendChild(opt);
        });
    }
}

function updateBalancesUI(){
    // update user node balance labels
    Array.from(simulator.querySelectorAll('.node')).forEach(el => {
        if (el.dataset.type === 'network') return;
        const bal = el.querySelector('.balance');
        if (bal) bal.textContent = `${userDB.getBalance(el.dataset.name)} 원`;
    });
    // refresh selects
    populateTxSelects();
}

// details panel
function openDetails(username) {
    selectedUser = username;
    detailsPanel.setAttribute('aria-hidden','false');
    detailNameText.textContent = username;
    // if it's a network node, show chain
    const nodeObj = getNodeByName(username);
    if (nodeObj) {
        detailBalanceText.textContent = `Blocks: ${nodeObj.chain.length}`;
        const chainList = detailsPanel.querySelector('.chain-list') || document.createElement('div');
        chainList.className = 'chain-list';
        chainList.innerHTML = '';
        nodeObj.chain.slice().reverse().forEach((blk) => {
            const item = document.createElement('div');
            item.className = 'chain-item';
            if (blk.index === 0) {
                item.innerHTML = `<div class="meta">Genesis Block</div>`;
            } else {
                item.innerHTML = `<div><strong>${blk.transaction.from} → ${blk.transaction.to}</strong></div><div class="meta">amount: ${blk.transaction.amount} — idx:${blk.index}</div>`;
            }
            chainList.appendChild(item);
        });
        // attach or replace
        const existing = detailsPanel.querySelector('.chain-list');
        if (!existing) detailsPanel.appendChild(chainList);
    } else {
        detailBalanceText.textContent = userDB.getBalance(username);
        const existing = detailsPanel.querySelector('.chain-list');
        if (existing) existing.remove();
    }
}
function closeDetailsPanel(){
    selectedUser = null;
    detailsPanel.setAttribute('aria-hidden','true');
}

renameBtn.addEventListener('click', ()=>{
    if (!selectedUser) return;
    const newName = prompt('새 이름을 입력하세요', selectedUser);
    if (!newName) return;
    if (userDB.userExists(newName)) { showCenterMessage('이미 존재하는 이름입니다'); return; }
    // rename in userDB
    const bal = userDB.getBalance(selectedUser);
    delete userDB.users[selectedUser];
    userDB.users[newName] = { password:'', balance:bal };
    selectedUser = newName;
    renderUsers();
    openDetails(newName);
});

changeBalanceBtn.addEventListener('click', ()=>{
    if (!selectedUser) return;
    const v = prompt('변경할 잔액을 입력하세요', userDB.getBalance(selectedUser));
    const n = Number(v);
    if (Number.isNaN(n)) { showCenterMessage('유효한 숫자를 입력하세요'); return; }
    userDB.users[selectedUser].balance = n;
    renderUsers();
    openDetails(selectedUser);
});

deleteUserBtn.addEventListener('click', ()=>{
    if (!selectedUser) return;
    if (!confirm(`${selectedUser} 를 삭제하시겠습니까?`)) return;
    
    if (currentView === 'user') {
        // delete user
        delete userDB.users[selectedUser];
        closeDetailsPanel();
        renderUsers();
    } else {
        // delete network node
        const idx = network.nodes.findIndex(n => n.name === selectedUser);
        if (idx >= 0) {
            network.nodes.splice(idx, 1);
        }
        closeDetailsPanel();
        renderNodes();
        populateTxSelects();
    }
});

// closeDetails listener removed (no close button in details panel)

addUserBtn.addEventListener('click', ()=>{
    // open modal in current view mode (user vs node)
    if (currentView === 'user') {
        if (userDB.getAllUsers().length >= 4) { showCenterMessage('유저는 최대 4명까지 추가 가능합니다'); return; }
        prepareModalFor('user');
    } else {
        if (network.nodes.length >= 8) { showCenterMessage('노드는 최대 8개까지 지원합니다'); return; }
        prepareModalFor('node');
    }
    modal.setAttribute('aria-hidden','false');
});

cancelCreateBtn.addEventListener('click', ()=>{
    modal.setAttribute('aria-hidden','true');
});

function prepareModalFor(mode){
    const modalTitle = document.querySelector('.modal-inner h3');
    const labelName = document.getElementById('labelName');
    const labelAmount = document.getElementById('labelAmount');
    if (mode === 'user'){
        modalTitle.textContent = '사용자 추가';
        labelName.firstChild.textContent = '이름 ';
        labelAmount.style.display = 'block';
        addUserBtn.textContent = '사용자 추가';
    } else {
        modalTitle.textContent = '노드 추가';
        labelName.firstChild.textContent = '노드 이름 ';
        labelAmount.style.display = 'none';
        addUserBtn.textContent = '노드 추가';
    }
    modal.dataset.mode = mode;
}


createUserBtn.addEventListener('click', ()=>{
    const mode = modal.dataset.mode || 'user';
    const name = (newUserName.value||'').trim();
    const amt = Number(newUserAmount.value||0);
    if (!name) { showCenterMessage('이름을 입력하세요'); return; }
    if (mode === 'user'){
        if (userDB.userExists(name)) { showCenterMessage('이미 존재하는 사용자입니다'); return; }
        if (userDB.getAllUsers().length >= 4) { showCenterMessage('유저는 최대 4명까지 추가 가능합니다'); return; }
        userDB.registerUser(name,'',amt);
        modal.setAttribute('aria-hidden','true');
        newUserName.value=''; newUserAmount.value='0';
        renderUsers();
    } else {
        // create network node
        if (getNodeByName(name)) { showCenterMessage('이미 존재하는 노드 이름입니다'); return; }
        const node = new Node(name);
        network.nodes.push(node);
        modal.setAttribute('aria-hidden','true');
        newUserName.value='';
        renderNodes();
        populateTxSelects();
    }
});

// transaction handling
txForm.addEventListener('submit',(e)=>{
    e.preventDefault();
    const from = txFrom.value;
    const to = txTo.value;
    const origin = txOrigin && txOrigin.value ? txOrigin.value : (network.nodes[0] && network.nodes[0].name);
    const amount = Number(txAmount.value);
    if (!from || !to) { showCenterMessage('송신자/수신자를 선택하세요'); return; }
    if (from===to) { showCenterMessage('송신자와 수신자가 동일할 수 없습니다'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { showCenterMessage('유효한 금액을 입력하세요'); return; }
    // check existence and balance
    if (!userDB.userExists(from)) { showCenterMessage(`송신자 '${from}'이 존재하지 않습니다`); return; }
    if (!userDB.userExists(to)) { showCenterMessage(`수신자 '${to}'이 존재하지 않습니다`); return; }
    if (userDB.getBalance(from) < amount) { showCenterMessage(`'${from}'의 잔액이 부족합니다`); return; }

    // perform transaction: create block at selected origin node
    try {
        const tx = { from, to, amount };
        const originNode = getNodeByName(origin) || nodeA;
        const newBlock = originNode.addBlock(tx);
        // update origin node chain length in UI immediately (if visible)
        const originElDom = simulator.querySelector(`.node[data-name="${originNode.name}"]`);
        if (originElDom && originElDom.dataset.type === 'network') {
            const bal = originElDom.querySelector('.balance');
            if (bal) bal.textContent = `chain ${originNode.chain.length}`;
        }
        // visualize broadcast to other nodes
        visualizeBroadcast(originNode.name, newBlock);
        // update balances
        userDB.updateBalance(from, -amount);
        userDB.updateBalance(to, amount);
        // update balance texts in-place without re-rendering positions
            updateBalancesUI();        
    } catch (err) {
        // In node view show a red X near origin node, otherwise show center error text
        if (currentView === 'node') {
            const originName = origin;
            const originElDom = simulator.querySelector(`.node[data-name="${originName}"]`);
            const simRect = simulator.getBoundingClientRect();
            if (originElDom) {
                const r = originElDom.getBoundingClientRect();
                const status = document.createElement('div');
                status.className = 'status-icon err';
                status.textContent = '✕';
                status.style.left = `${r.left - simRect.left + r.width/2 + 10}px`;
                status.style.top = `${r.top - simRect.top + 6}px`;
                packetContainer.appendChild(status);
                setTimeout(()=>{ status.classList.add('hide'); setTimeout(()=>status.remove(),350); },2000);
            } else {
                showCenterMessage(err.message);
            }
        } else {
            showCenterMessage(err.message);
        }
    }
});

// initialize
// initial render obeys current view
function renderCurrentView(){
    if (currentView === 'user') renderUsers(); else renderNodes();
}

userViewBtn.addEventListener('click', ()=>{
    currentView = 'user';
    userViewBtn.classList.add('active'); nodeViewBtn.classList.remove('active');
    addUserBtn.textContent = '사용자 추가';
    linksSvg.innerHTML = '';
    renderCurrentView();
});

nodeViewBtn.addEventListener('click', ()=>{
    currentView = 'node';
    nodeViewBtn.classList.add('active'); userViewBtn.classList.remove('active');
    addUserBtn.textContent = '노드 추가';
    renderCurrentView();
});

// initial population and render
populateTxSelects();
renderCurrentView();


