import { Snake } from "../entities/Snake";
import { Food } from "../entities/Food";
import { Obstacle } from "../entities/Obstacle";
import { Position } from "../types/Position";
import { GameConfig } from "../config/GameConfig";
import { EntityManager } from "../managers/EntityManager";
import { VortexFieldManager } from "../managers/VortexFieldManager";
import { VortexZoneType } from "../types/VortexField";

export interface CollisionResult {
  type: "wall" | "obstacle" | "food" | "snake" | "treasure_chest" | "key" | "treasure_fatal";
  snake: Snake; // The snake that collided
  collidedWith?: Food | Obstacle | Snake | Position | any; // What it collided with (using any for treasure/key)
  position: Position; // Where the collision occurred (head position)
}

/**
 * Detects collisions between snakes and other game elements.
 */
export class CollisionDetector {
  private vortexFieldManager?: VortexFieldManager;

  constructor(vortexFieldManager?: VortexFieldManager) {
    this.vortexFieldManager = vortexFieldManager;
  }

  /**
   * Detects all collisions for the given set of active snakes for the current tick.
   * @param snakes - An array of currently active (alive) snakes.
   * @param allSnakes - The full list of snakes (including dead ones for body checks).
   * @param entityManager - The EntityManager instance to query for nearby items.
   * @returns An array of CollisionResult objects describing detected collisions *for this tick*.
   */
  detectCollisions(
    snakes: Snake[],
    allSnakes: Snake[],
    entityManager: EntityManager
  ): CollisionResult[] {
    const collisionResults: CollisionResult[] = [];
    const boxSize = GameConfig.CANVAS.BOX_SIZE;
    const columns = GameConfig.CANVAS.COLUMNS;
    const rows = GameConfig.CANVAS.ROWS;

    // Keep track of snakes that have already had a fatal collision this tick
    const fatallyCollidedSnakes = new Set<Snake>();

    for (const snake of snakes) {
      // If this snake already had a fatal collision determined in this tick, skip further checks for it
      // Also skip snakes that are in death animation
      if (fatallyCollidedSnakes.has(snake) || !snake.isAlive() || snake.isDyingAnimation()) {
        continue;
      }

      const head = snake.getBody()[0];
      const hasShield = snake.isShieldActive();
      let fatalCollisionOccurred = false; // Flag for this snake in this tick

      // Check lethal singularity first (shields don't protect against this)
      if (this.vortexFieldManager) {
        const zoneType = this.vortexFieldManager.getPositionZoneType(head);
        if (zoneType === VortexZoneType.LETHAL_SINGULARITY) {
          // console.log(
          //   `[Collision][Fatal][Vortex] Snake ${snake.getMetadata().name} entered lethal singularity at (${
          //     head.x / boxSize
          //   }, ${head.y / boxSize})`
          // );
          collisionResults.push({ 
            type: "wall", // Using "wall" type as it's also an absolute fatal collision 
            snake: snake, 
            position: head 
          });
          fatalCollisionOccurred = true;
          fatallyCollidedSnakes.add(snake);
          continue; // Skip other collision checks for this snake
        }
      }

      // 1. Boundary Collision
      if (
        head.x < 0 ||
        head.x >= columns * boxSize ||
        head.y < 0 ||
        head.y >= rows * boxSize
      ) {
        // console.log(
        //   `[Collision][Fatal] Snake ${snake.getMetadata().name} hit wall at (${
        //     head.x / boxSize
        //   }, ${head.y / boxSize})`
        // );
        collisionResults.push({ type: "wall", snake: snake, position: head });
        fatalCollisionOccurred = true;
        fatallyCollidedSnakes.add(snake); // Mark as fatally collided
        continue; // Move to the next snake
      }

      // 2. Check nearby items using EntityManager's query method
      const nearbyItems = entityManager.findNearbyGridItems(head, boxSize);

      for (const item of nearbyItems) {
        // Check for exact position match
        if (item.position.x === head.x && item.position.y === head.y) {
          switch (item.type) {
            case "obstacle":
              // console.log(
              //   `[Collision][Fatal] Snake ${
              //     snake.getMetadata().name
              //   } hit obstacle at (${head.x / boxSize}, ${head.y / boxSize})`
              // );
              collisionResults.push({
                type: "obstacle",
                snake: snake,
                collidedWith: item.position,
                position: head,
              });
              fatalCollisionOccurred = true;
              break; // Break from switch, let outer loop check fatal flag

            case "food":
              // Food collision is not fatal, just report it
              // GameManager will handle removing the food and scoring
              collisionResults.push({
                type: "food",
                snake: snake,
                collidedWith: item.position,
                position: head,
              });
              // Continue checking other nearby items for this snake
              break;

            case "key":
              // Key collision is not fatal, only report if snake doesn't already have a key
              if (!snake.hasKey()) {
                collisionResults.push({
                  type: "key",
                  snake: snake,
                  collidedWith: item.position,
                  position: head,
                });
              }
              // If snake already has a key, ignore this collision completely
              break;

            case "treasure_chest":
              // Treasure chest: fatal if snake has no key (shields do not help); otherwise non-fatal open attempt
              if (snake.hasKey()) {
                collisionResults.push({
                  type: "treasure_chest",
                  snake: snake,
                  collidedWith: item.position,
                  position: head,
                });
              } else {
                // console.log(
                //   `[Collision][Fatal] Snake ${
                //     snake.getMetadata().name
                //   } hit treasure (no key) at (${head.x / boxSize}, ${head.y / boxSize})`
                // );
                collisionResults.push({
                  type: "treasure_fatal",
                  snake: snake,
                  collidedWith: item.position,
                  position: head,
                });
                fatalCollisionOccurred = true;
              }
              break;

            case "snake":
              // Collision with another snake's segment
              // 检查是否与其他蛇发生碰撞（头部或身体）
              // 首先检查是否与其他蛇的头部发生碰撞
              const otherSnakeHead = allSnakes.find(
                (os) =>
                  os !== snake &&
                  os.isAlive() &&
                  !fatallyCollidedSnakes.has(os) && // 检查其他蛇是否已经被标记为死亡
                  os.getBody()[0]?.x === head.x &&
                  os.getBody()[0]?.y === head.y
              );

              if (otherSnakeHead) {
                // 蛇头对蛇头碰撞 - 考虑护盾逻辑
                const otherHasShield = otherSnakeHead.isShieldActive();
                
                // 如果两条蛇都有护盾，则都免疫碰撞，不报告碰撞
                if (hasShield && otherHasShield) {
                  // console.log(`[SHIELD] Both snakes ${snake.getMetadata().name} and ${otherSnakeHead.getMetadata().name} have shields, both immune to head collision`);
                  // 不报告碰撞，继续检查其他碰撞
                } else {
                  // 至少有一条蛇没有护盾，报告碰撞让GameManager处理
                  // console.log(
                  //   `[Collision] Snake ${snake.getMetadata().name} head collision with Snake ${otherSnakeHead.getMetadata().name}`
                  // );
                  collisionResults.push({
                    type: "snake",
                    snake: snake,
                    collidedWith: otherSnakeHead,
                    position: head,
                  });
                  fatalCollisionOccurred = true;
                }
              } else {
                // 检查是否与其他蛇的身体发生碰撞
                const collidedSnake = allSnakes.find(
                  (os) =>
                    // 检查是否是另一条蛇的身体部分
                    os !== snake &&
                    os.isAlive() &&
                    os.getBody().some((seg) => seg.x === head.x && seg.y === head.y)
                );

                if (collidedSnake) {
                  // 检查涡流场幽灵穿行规则
                  const isInVortexField = this.vortexFieldManager?.isPositionInVortexField(head) || false;
                  
                  // 如果有护盾或在涡流场内，可以穿过蛇身体
                  if (hasShield || isInVortexField) {
                    // if (hasShield) {
                    //   console.log(`[SHIELD] Snake ${snake.getMetadata().name} shield passed through body of Snake ${collidedSnake.getMetadata().name}`);
                    // } else {
                    //   console.log(`[VORTEX] Snake ${snake.getMetadata().name} passed through body of Snake ${collidedSnake.getMetadata().name} in vortex field`);
                    // }
                  } else {
                    // 没有护盾且不在涡流场：与任何蛇的身体部分碰撞都是致命的
                    // console.log(
                    //   `[Collision][Fatal] Snake ${snake.getMetadata().name} hit body of Snake ${collidedSnake.getMetadata().name}`
                    // );
                    collisionResults.push({
                      type: "snake",
                      snake: snake,
                      collidedWith: collidedSnake,
                      position: head,
                    });
                    fatalCollisionOccurred = true;
                  }
                }
              }
              break; // Break from switch
          } // End switch
        } // End if exact position match

        // If a fatal collision was detected inside the switch for this snake,
        // no need to check further nearby items for this snake in this tick.
        if (fatalCollisionOccurred) {
          break; // Break the inner 'for (const item of nearbyItems)' loop
        }
      } // End inner loop (nearby items)

      // If a fatal collision occurred for this snake, add it to the set
      // so if it was involved in multiple fatal collisions (e.g., head-on),
      // we process it only once as the primary collider.
      if (fatalCollisionOccurred) {
        fatallyCollidedSnakes.add(snake);
      }
    } // End outer loop (snakes)

    // 将致命事件置于前面，同时保持同类事件的相对稳定顺序
    const fatalTypes = new Set<CollisionResult["type"]>([
      "wall",
      "obstacle",
      "snake",
      "treasure_fatal",
    ]);

    const fatalEvents = collisionResults.filter((r) => fatalTypes.has(r.type));
    const nonFatalEvents = collisionResults.filter((r) => !fatalTypes.has(r.type));

    return [...fatalEvents, ...nonFatalEvents];
  }
}
