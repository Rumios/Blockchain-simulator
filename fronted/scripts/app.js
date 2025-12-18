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

    // 동기화 및 검사
    syncBlock(block) {
        if (block.previousHash === this.getLastestBlock().hash) {
            this.chain.block(block);
        }
    }
}

class Network {
    constructor(nodes) {
        this.nodes = nodes;
    }

    broadcast(block, originNode) {
        this.nodes.forEach((node) => {
            if (node !== originNode) node.syncBlock(block);
        });
    }
}

const Genesis_Block = new Node("Genesis Block");

const tx = {
    from: "Alice",
    to: "Bob",
    amount: 100,
};

Genesis_Block.addBlock(tx);

console.log(Genesis_Block.chain);
