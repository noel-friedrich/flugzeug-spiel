const canvas = document.getElementById("game-canvas")
const context = canvas.getContext("2d")

function syncCanvasSize() {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
}

class Assets {

    static playerPlaneImage = null
    static enemyPlaneImage = null
    static heartImage = null

    static loseAudio = null
    static planecrashAudio = null
    static plopAudio = null
    static winAudio = null
    static ouAudio = null
    static losgehtsAudio = null

    static async loadImage(path) {
        return new Promise((resolve, reject) => {
            let image = new Image()
            image.onload = () => resolve(image)
            image.onerror = reject
            image.src = path
        })
    }

    static async loadAudio(path) {
        return new Promise((resolve, reject) => {
            let audio = new Audio()
            audio.oncanplaythrough = () => resolve(audio)
            audio.preload = true
            audio.onerror = reject
            audio.src = path
        })
    }

    static playAudio(audio) {
        try {
            audio.play()
            audio.currentTime = 0
        } catch (e) {
            // ignore
        }
    }

    static async init() {
        this.playerPlaneImage = await this.loadImage("assets/images/player-plane.png")
        this.enemyPlaneImage = await this.loadImage("assets/images/enemy-plane.png")
        this.heartImage = await this.loadImage("assets/images/heart.png")
        console.log("loaded images")

        this.loseAudio = await this.loadAudio("assets/sounds/lose.mp3")
        this.planecrashAudio = await this.loadAudio("assets/sounds/planecrash.mp3")
        this.plopAudio = await this.loadAudio("assets/sounds/plop.mp3")
        this.winAudio = await this.loadAudio("assets/sounds/win.mp3")
        this.ouAudio = await this.loadAudio("assets/sounds/ou.mp3")
        this.losgehtsAudio = await this.loadAudio("assets/sounds/losgehts.mp3")
        console.log("loaded audios")
    }

}

const PlaneType = {
    Player: 0,
    Enemy: 1
}

function canvasScaleFactor() {
    return Math.min(canvas.width, canvas.height) / 200
}

function updatePosition(x, y, rotation, speed) {
    let velocityX = Math.cos(rotation) * speed * canvasScaleFactor()
    let velocityY = Math.sin(rotation) * speed * canvasScaleFactor()
    return [x + velocityX, y + velocityY]
}

class Plane {

    constructor(type) {
        this.x = 0
        this.y = 0
        this.rotation = 0
        this.type = type
        this.size = 20
        this.speed = 0.8
        this.turnSpeed = 0.05
        this.projectileSpeed = 2

        this.alive = true

        this.aiTurnSpeed = 0
        this.aiMoveCount = 0
        this.aiMoveInterval = 20

        this.shootCooldown = 200
        this.shootCooldownMax = 10
        this.shootCount = 0
        this.shootChance = 0.05
        this.spawnImmunityCount = 200
        
        this.lives = 10
    }

    setPosition(x, y) {
        this.x = x
        this.y = y
    }

    get image() {
        return this.type == PlaneType.Player
            ? Assets.playerPlaneImage
            : Assets.enemyPlaneImage
    }

    hit() {
        if (this.type == PlaneType.Player) {
            Assets.playAudio(Assets.ouAudio)
        }

        if (this.lives > 1) {
            this.lives--
        } else {
            this.lives = 0
            this.die()
        }
    }

    moveAI() {
        if (Math.random() < this.shootChance) {
            this.shoot()
        }

        this.rotation += this.aiTurnSpeed
        this.aiMoveCount++
        if (this.aiMoveCount % this.aiMoveInterval != 0) {
            return
        }

        let possibleMoves = [
            -this.turnSpeed,
            0,
            this.turnSpeed
        ]

        let bestMove = 0
        let bestMoveIndex = 1
        let lowestScore = Infinity
        for (let i = 0; i < possibleMoves.length; i++) {
            let option = possibleMoves[i]

            let [newX, newY] = updatePosition(
                this.x, this.y,
                this.rotation + option,
                this.speed
            )

            let distance = Math.sqrt(
                (newX - playerPlane.x) ** 2 +
                (newY - playerPlane.y) ** 2
            )

            if (distance < lowestScore) {
                lowestScore = distance
                bestMove = option
                bestMoveIndex = i
            }
        }

        this.aiTurnSpeed = bestMove
    }

    get projectileOffset() {
        let rotation = 1 + this.rotation
        if (this.shootCount % 2 == 0) {
            rotation = -1 + this.rotation
        }

        return {
            x: Math.cos(rotation) * this.sizePx * 0.3,
            y: Math.sin(rotation) * this.sizePx * 0.3
        }
    }

    update() {
        if (this.dead) {
            return
        }

        if (this.spawnImmunityCount > 0) {
            this.spawnImmunityCount--
        }
        
        if (this.type == PlaneType.Player) {
            if (this.x < 0 || this.y < 0
                || this.x > canvas.width
                || this.y > canvas.height) {
                    this.rotation += Math.PI
                }
        } else {
            if (this.x < 0 || this.y < 0
                || this.x > canvas.width
                || this.y > canvas.height) {
                    this.rotation = Math.atan2(
                        (this.y - playerPlane.y),
                        (this.x - playerPlane.x)
                    ) + Math.PI
                }
        }

        if (this.shootCooldown > 0) {
            this.shootCooldown--
        }

        let [newX, newY] = updatePosition(this.x, this.y, this.rotation, this.speed)
        this.x = newX
        this.y = newY

        for (let projectile of projectiles) {
            if (!projectile.alive) continue
            if (projectile.type == this.type) continue
            if (this.spawnImmune) continue

            if (this.hitTest(projectile.x, projectile.y)) {
                this.hit()
                projectile.die()
            }
        }
    }

    get spawnImmune() {
        return this.spawnImmunityCount > 0
    }

    die() {
        this.alive = false
        Assets.playAudio(Assets.planecrashAudio)

        if (this.type == PlaneType.Player) {
            Assets.playAudio(Assets.loseAudio)
        }
    }

    hitTest(x, y) {
        let box = this.hitbox
        return (
            box.x < x
            && box.y < y
            && x < box.x + box.dx
            && y < box.y + box.dy
        )
    }
    
    get sizePx() {
        return this.size * canvasScaleFactor()
    }

    get dead() {
        return !this.alive
    }

    shoot() {
        if (this.dead) return
        if (this.shootCooldown != 0) return

        projectiles.push(
            new Projectile(
                this.x + this.projectileOffset.x,
                this.y + this.projectileOffset.y,
                this.rotation,
                this.type,
                this.speed + this.projectileSpeed
            )
        )

        Assets.playAudio(Assets.plopAudio)

        this.shootCooldown = this.shootCooldownMax
        this.shootCount++
    }

    get hitbox() {
        return {
            x: this.x - this.sizePx / 2,
            y: this.y - this.sizePx / 2,
            dx: this.sizePx,
            dy: this.sizePx
        }
    }

    drawHitbox() {
        context.fillStyle = "rgba(0, 255, 0, 0.5)"
        context.fillRect(this.hitbox.x, this.hitbox.y, this.hitbox.dx, this.hitbox.dy)
    }

    draw() {
        context.imageSmoothingEnabled = false
        context.save()
        if (this.spawnImmune)
            context.globalAlpha = 0.5
        context.translate(
            this.x,
            this.y
        )
        context.rotate(this.rotation + Math.PI / 2)
        context.drawImage(
            this.image,
            - this.sizePx / 2,
            - this.sizePx / 2,
            this.sizePx, this.sizePx
        )
        context.restore()
    }

    turnLeft() {
        if (this.dead) return
        this.rotation -= this.turnSpeed
    }

    turnRight() {
        if (this.dead) return
        this.rotation += this.turnSpeed
    }

    drawLives() {
        let sizePx = 10 * canvasScaleFactor()
        for (let i = 0; i < this.lives; i++) {
            let x = (i + 1) * sizePx
            let y = canvas.height - 2 * sizePx
            context.drawImage(
                Assets.heartImage,
                x, y, sizePx, sizePx
            )
        }
    }

    drawStatus() {
        this.drawLives()
    }

}

class Projectile {

    constructor(x, y, rotation, type, speed) {
        this.x = x
        this.y = y
        this.rotation = rotation
        this.speed = speed
        this.size = 3
        this.type = type
        
        this.alive = true
    }

    die() {
        this.alive = false
    }

    update() {
        let [newX, newY] = updatePosition(this.x, this.y, this.rotation, this.speed)
        this.x = newX
        this.y = newY

        if (this.x < -this.sizePx || this.y < -this.sizePx
            || this.x > canvas.width + this.sizePx
            || this.y > canvas.height + this.sizePx) {
                this.die()
            }
    }

    get color() {
        return this.type == PlaneType.Player
            ? "rgba(0, 0, 255, 0.5)"
            : "rgba(255, 0, 0, 0.5)"
    }

    get sizePx() {
        return this.size * canvasScaleFactor()
    }

    draw() {
        context.fillStyle = this.color
        context.fillRect(
            this.x - this.sizePx / 2,
            this.y - this.sizePx / 2,
            this.sizePx, this.sizePx
        )
    }

}

class Level {

    constructor(numEnemies, enemyShootChance=null, enemySpeed=null, enemyTurnSpeed=null, enemyLives=1, projectileSpeed=null) {
        this.numEnemies = numEnemies
        this.enemyShootChance = enemyShootChance
        this.enemySpeed = enemySpeed
        this.enemyTurnSpeed = enemyTurnSpeed
        this.enemyLives = enemyLives
        this.projectileSpeed = projectileSpeed
    }

    begin() {
        for (let i = 0; i < this.numEnemies; i++) {
            let enemy = spawnEnemy()
            enemy.speed = this.enemySpeed ?? enemy.speed
            enemy.shootChance = this.enemyShootChance ?? enemy.shootChance
            enemy.turnSpeed = this.enemyTurnSpeed ?? enemy.turnSpeed
            enemy.lives = this.enemyLives ?? enemy.lives
            enemy.projectileSpeed = this.projectileSpeed ?? enemy.projectileSpeed
        }
    }

}

let levels = [
    new Level(1, 0.005, 0.5, 0.01, 1),
    new Level(2, 0.01, 2, 0, 1),
    new Level(2, 0.01, 0.6, 0.03, 1),
    new Level(30, 0.001, 0.2, 0.01, 1),
    new Level(1, 0.05, 1, 0.01, 10),
    new Level(1, 1, 0.5, 0.02, 10, 0.5),
    new Level(5, 0.01, 1, 0.03, 1),
    new Level(3, 1, 0.5, 0.01, 10, 0.5),
    new Level(1, 0.5, 3, 0, 8),
    new Level(10, 0.5, 3, 0, 1),
]

let playerPlane = new Plane(PlaneType.Player)
let projectiles = new Array()
let enemies = new Array()
const keysDown = new Set()
let gameStarted = false

function drawTextMiddle(text, size=40, opacity=0.2, lineOffset=0, font="serif") {
    context.font = `${size * canvasScaleFactor()}px ${font}`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = `rgba(0, 0, 0, ${opacity})`
    context.fillText(text, canvas.width / 2, canvas.height / 2 + lineOffset * size * canvasScaleFactor() * 1.3)
}

window.addEventListener("keydown", event => keysDown.add(event.key))
window.addEventListener("keyup", event => keysDown.delete(event.key))

function spawnEnemy() {
    let sideIndex = Math.floor(Math.random() * 4)

    let enemy = new Plane(PlaneType.Enemy)

    let x = 0
    let y = 0
    if (sideIndex == 0) {
        x = Math.random() * canvas.width
        y = -enemy.sizePx
    } else if (sideIndex == 1) {
        x = Math.random() * canvas.width
        y = canvas.height + enemy.sizePx
    } else if (sideIndex == 2) {
        x = -enemy.sizePx
        y = Math.random() * canvas.height
    } else if (sideIndex == 3) {
        x = canvas.width + enemy.sizePx
        y = Math.random() * canvas.height
    }

    enemy.setPosition(x, y)
    //enemy.setPosition(canvas.width / 2, canvas.height / 2)
    enemy.speed *= Math.random() * 0.5 + 0.5
    enemy.turnSpeed *= Math.random() * 0.5 + 0.3
    enemy.rotation = Math.atan2(
        (enemy.y - playerPlane.y),
        (enemy.x - playerPlane.x)
    ) + Math.PI 
    enemies.push(enemy)

    return enemy
}

function handleInputs() {
    if (!gameStarted) {
        if (keysDown.has(" ")) {
            startGame()
            keysDown.delete(" ")
        }
    } else {
        if (keysDown.has("ArrowLeft")) {
            playerPlane.turnLeft()
        } else if (keysDown.has("ArrowRight")) {
            playerPlane.turnRight()
        }
        
        if (keysDown.has(" ")) {
            if (playerPlane.dead) {
                location.reload()
            }

            playerPlane.shoot()
            keysDown.delete(" ")
        }
    }

}

function startGame() {
    levelIndex = -1
    gameStarted = true
    playerPlane = new Plane(PlaneType.Player)
    playerPlane.setPosition(canvas.width / 2, canvas.height / 2)
    playerPlane.rotation = Math.PI * 2 * Math.random()
    playerPlane.spawnImmunityCount = 0
    playerPlane.shootCooldown = 0
    playerPlane.lives = 10

    enemies = []
    projectiles = []

    Assets.playAudio(Assets.losgehtsAudio)
}

window.addEventListener("click", event => {
    if (!gameStarted) startGame()
    else if (playerPlane.dead) location.reload()
})

let levelIndex = -1

function loop() {
    context.clearRect(0, 0, canvas.width, canvas.height)

    if (!gameStarted) {
        handleInputs()
        
        playerPlane.setPosition(canvas.width / 2, canvas.height / 2)

        for (let enemy of enemies) {
            enemy.moveAI()
            enemy.update()
            enemy.draw()
        }
    
        for (let projectile of projectiles) {
            projectile.update()
            projectile.draw()
        }
    
        projectiles = projectiles.filter(p => p.alive)
        enemies = enemies.filter(e => e.alive)
        
        if (enemies.length < 10 && !gameStarted) {
            let enemy = spawnEnemy()
            enemy.spawnImmunityCount = 0
            enemy.speed = 2
            enemy.shootChance = 0.1
        }

        drawTextMiddle("Flugzeug Spiel", 20, 1, -0.5, "monospace")
        drawTextMiddle("Clicke zum Starten", 20, 1, 0.5)
    } else {
        if (playerPlane.dead) {
            drawTextMiddle(`Du bist Tot.`, 30, 0.3, -0.5)
            drawTextMiddle("Clicke zum Neustart", 20, 1, 0.5)
        } else if (levelIndex == levels.length) {
            drawTextMiddle(`Du hast gewonnen!.`, 30, 0.3, -0.5)
            drawTextMiddle("Clicke zum Neustart", 20, 1, 0.5)
        } else {
            drawTextMiddle(`Level ${levelIndex + 1}`)
        }
    
        handleInputs()
        playerPlane.update()
        playerPlane.draw()
        playerPlane.drawStatus()
    
        for (let enemy of enemies) {
            enemy.moveAI()
            enemy.update()
            enemy.draw()
        }
    
        for (let projectile of projectiles) {
            projectile.update()
            projectile.draw()
        }
    
        projectiles = projectiles.filter(p => p.alive)
        enemies = enemies.filter(e => e.alive)
    
        if (enemies.length == 0 && levelIndex < levels.length) {
            levelIndex++
            if (levels[levelIndex])
                levels[levelIndex].begin()
            if (levelIndex != 0)
                Assets.playAudio(Assets.winAudio)
        }
    }

    window.requestAnimationFrame(loop)
}

async function main() {
    syncCanvasSize()
    window.addEventListener("resize", syncCanvasSize)

    await Assets.init()

    loop()
}

main()
