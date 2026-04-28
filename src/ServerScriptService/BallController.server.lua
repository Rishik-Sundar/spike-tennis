-- Spike Tennis — BallController
-- Owns the ball Part, applies velocities, detects bounces and faults.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Constants  = require(ReplicatedStorage.Modules.Constants)
local ShotPhysics = require(ReplicatedStorage.Modules.ShotPhysics)
local C = Constants

-- Shared state (GameManager binds to these)
local BallController = {}

-- RemoteEvents (created by GameManager before this runs)
local Remotes

local ball        -- the Part
local ballTrail   -- Trail attachment
local lastShotType = "flat"
local bounceCount  = 0
local ballActive   = false
local lastBouncer  = 0      -- player index who last hit
local onBounceCallback  = nil
local onFaultCallback   = nil
local onNetCallback     = nil

-- ─── Create ball ────────────────────────────────────────────────────────────
local function createBall()
    if ball then ball:Destroy() end

    ball = Instance.new("Part")
    ball.Name = "SpikeBall"
    ball.Shape = Enum.PartType.Ball
    ball.Size = Vector3.new(C.BALL.RADIUS * 2, C.BALL.RADIUS * 2, C.BALL.RADIUS * 2)
    ball.Color = C.COLORS.BALL
    ball.Material = Enum.Material.Neon
    ball.Elasticity = 0
    ball.Friction = 0.4
    ball.CustomPhysicalProperties = PhysicalProperties.new(0.5, 0.4, 0, 0.3, 0.3)
    ball.CastShadow = true
    ball.CanCollide = true
    ball.Parent = workspace

    -- Glow SelectionBox trick for aura
    local sel = Instance.new("SelectionBox")
    sel.Adornee = ball
    sel.Color3 = C.COLORS.BALL
    sel.LineThickness = 0.06
    sel.SurfaceTransparency = 0.92
    sel.Parent = ball

    -- Trail
    local att0 = Instance.new("Attachment")
    att0.Name = "TrailAtt0"
    att0.Position = Vector3.new(C.BALL.RADIUS, 0, 0)
    att0.Parent = ball

    local att1 = Instance.new("Attachment")
    att1.Name = "TrailAtt1"
    att1.Position = Vector3.new(-C.BALL.RADIUS, 0, 0)
    att1.Parent = ball

    ballTrail = Instance.new("Trail")
    ballTrail.Attachment0 = att0
    ballTrail.Attachment1 = att1
    ballTrail.Lifetime = 0.22
    ballTrail.MinLength = 0.04
    ballTrail.FaceCamera = true
    ballTrail.Color = ColorSequence.new({
        ColorSequenceKeypoint.new(0, C.COLORS.BALL_TRAIL),
        ColorSequenceKeypoint.new(1, Color3.fromRGB(255, 255, 255)),
    })
    ballTrail.Transparency = NumberSequence.new({
        NumberSequenceKeypoint.new(0, 0),
        NumberSequenceKeypoint.new(1, 1),
    })
    ballTrail.WidthScale = NumberSequence.new({
        NumberSequenceKeypoint.new(0, 1),
        NumberSequenceKeypoint.new(1, 0),
    })
    ballTrail.Parent = ball

    -- Bounce detection
    ball.Touched:Connect(function(hit)
        if not ballActive then return end
        if hit.Name == "CourtSurface" then
            handleCourtBounce()
        elseif hit.Name:sub(1, 3) == "Net" then
            handleNetHit()
        end
    end)

    return ball
end

function handleCourtBounce()
    local vel = ball.AssemblyLinearVelocity
    if vel.Y > 0 then return end  -- already bouncing up, ignore

    local newVel = ShotPhysics.calculateBounce(vel, lastShotType)
    ball.AssemblyLinearVelocity = newVel
    bounceCount = bounceCount + 1

    -- Spark effect at bounce point
    spawnBounceEffect(ball.Position)

    if onBounceCallback then
        onBounceCallback(ball.Position, bounceCount, lastBouncer)
    end
end

function handleNetHit()
    if onNetCallback then
        onNetCallback(lastBouncer)
    end
end

function spawnBounceEffect(pos)
    local sparks = Instance.new("Part")
    sparks.Size = Vector3.new(0.5, 0.5, 0.5)
    sparks.Position = pos
    sparks.Anchored = true
    sparks.CanCollide = false
    sparks.Transparency = 1
    sparks.Parent = workspace

    local pe = Instance.new("ParticleEmitter")
    pe.Color = ColorSequence.new(C.COLORS.HIT_SPARK)
    pe.LightEmission = 1
    pe.LightInfluence = 0
    pe.Size = NumberSequence.new({
        NumberSequenceKeypoint.new(0, 0.3),
        NumberSequenceKeypoint.new(1, 0),
    })
    pe.Lifetime = NumberRange.new(0.2, 0.4)
    pe.Speed = NumberRange.new(8, 18)
    pe.SpreadAngle = Vector2.new(60, 60)
    pe.Rate = 0
    pe.Parent = sparks

    pe:Emit(12)
    game:GetService("Debris"):AddItem(sparks, 0.6)
end

-- ─── Public API ─────────────────────────────────────────────────────────────

function BallController.init(remotes)
    Remotes = remotes
    createBall()
end

function BallController.getBall()
    return ball
end

function BallController.setActive(state)
    ballActive = state
end

function BallController.resetBall()
    bounceCount = 0
    lastBouncer = 0
    lastShotType = "flat"
    if ball then
        ball.AssemblyLinearVelocity = Vector3.zero
        ball.AssemblyAngularVelocity = Vector3.zero
    end
end

function BallController.placeBallForServe(serverIndex, spawnPositions)
    BallController.resetBall()
    ballActive = false

    local pos = spawnPositions[serverIndex]
    ball.CFrame = CFrame.new(pos + Vector3.new(0, 8, 0))
    ball.Anchored = true

    -- Toss animation
    local tossDuration = C.GAME.SERVE_TOSS_TIME
    local tossHeight = C.GAME.SERVE_TOSS_HEIGHT
    local startPos = pos + Vector3.new(0, 1.5, 0)
    local peakPos  = pos + Vector3.new(0, tossHeight, 0)

    -- Tween up
    ball.CFrame = CFrame.new(startPos)
    local tweenUp = TweenService:Create(ball,
        TweenInfo.new(tossDuration * 0.55, Enum.EasingStyle.Sine, Enum.EasingDirection.Out),
        { CFrame = CFrame.new(peakPos) })
    tweenUp:Play()
    tweenUp.Completed:Wait()

    -- Tween down slightly (hang)
    local tweenHang = TweenService:Create(ball,
        TweenInfo.new(tossDuration * 0.2, Enum.EasingStyle.Sine, Enum.EasingDirection.In),
        { CFrame = CFrame.new(peakPos - Vector3.new(0, 1.5, 0)) })
    tweenHang:Play()
    tweenHang.Completed:Wait()

    ball.Anchored = false
    ball.AssemblyLinearVelocity = Vector3.zero

    return true
end

function BallController.applyHit(from, targetPos, shotType, timingQuality, hitterIndex)
    lastShotType = shotType
    lastBouncer = hitterIndex
    bounceCount = 0
    ballActive = true

    local vel = ShotPhysics.calculateVelocity(from, targetPos, shotType, timingQuality)
    ball.AssemblyLinearVelocity = vel

    -- Hit flash
    spawnBounceEffect(ball.Position)

    -- Notify clients
    if Remotes and Remotes.BallHit then
        Remotes.BallHit:FireAllClients(hitterIndex, shotType, timingQuality)
    end
end

function BallController.getBounceCount()
    return bounceCount
end

function BallController.getLastBouncer()
    return lastBouncer
end

function BallController.onBounce(callback)
    onBounceCallback = callback
end

function BallController.onNet(callback)
    onNetCallback = callback
end

-- Monitor out-of-bounds (call from GameManager heartbeat)
function BallController.checkBounds()
    if not ball or not ballActive then return nil end
    local pos = ball.Position

    -- Fell off court (Y below floor)
    if pos.Y < -5 then
        return "out_of_bounds"
    end

    return nil
end

return BallController
