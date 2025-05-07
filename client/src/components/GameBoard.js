import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { CELL_STATE, BOARD_SIZE, isValidPlacement } from '../utils/gameState';

const GameBoard = ({
      board,
      onCellPress,
      showShips = false,
      highlightPlacement = null,
      highlightLastMove = null,
      disabled = false,
}) => {
      // Use window dimensions for responsive sizing
      const window = useWindowDimensions();
      const [cellSize, setCellSize] = useState(30); // Default size

      // Recalculate cell size when window dimensions change
      useEffect(() => {
            // Get the smaller dimension to ensure the board fits on screen
            const smallerDimension = Math.min(window.width, window.height);

            // Calculate the maximum board size based on screen size
            // Use a fixed percentage of the screen for the board
            const maxBoardSize = smallerDimension * 0.8; // 80% of the smaller dimension

            // Calculate cell size based on the board size and number of cells
            // Add 1 to account for the labels
            const calculatedCellSize = Math.floor(maxBoardSize / (BOARD_SIZE + 1));

            // Ensure cell size is at least 20px and at most 40px
            const newCellSize = Math.min(Math.max(calculatedCellSize, 20), 40);

            console.log(`Window: ${window.width}x${window.height}, Cell size: ${newCellSize}`);
            setCellSize(newCellSize);
      }, [window.width, window.height]);

      // Track the current cell being hovered for ship placement preview
      const [hoverCell, setHoverCell] = useState({ row: 0, col: 0 });

      const renderCell = (row, col) => {
            const cell = board[row][col];
            let cellStyle = [styles.cell, { width: cellSize, height: cellSize }];
            let contentStyle = null;
            let content = null;

            // Determine cell style based on state
            if (cell.state === CELL_STATE.SHIP && showShips) {
                  cellStyle.push(styles.shipCell);
            } else if (cell.state === CELL_STATE.HIT) {
                  cellStyle.push(styles.hitCell);
                  content = '💥';
            } else if (cell.state === CELL_STATE.MISS) {
                  cellStyle.push(styles.missCell);
                  content = '•';
                  contentStyle = styles.missContent;
            }

            // Highlight last move if provided
            if (highlightLastMove && highlightLastMove.row === row && highlightLastMove.col === col) {
                  cellStyle.push(styles.lastMoveCell);
            }

            // Highlight potential ship placement
            if (highlightPlacement && highlightPlacement.ship) {
                  const { ship, isHorizontal } = highlightPlacement;

                  // Use the current hover cell for preview
                  const previewRow = hoverCell.row;
                  const previewCol = hoverCell.col;

                  // Check if this cell would be part of the ship placement
                  const isPartOfShip = isHorizontal
                        ? col >= previewCol && col < previewCol + ship.size && row === previewRow
                        : row >= previewRow && row < previewRow + ship.size && col === previewCol;

                  // Check if placement would be valid
                  const isValid = isValidPlacement(board, ship, previewRow, previewCol, isHorizontal);

                  if (isPartOfShip) {
                        cellStyle.push(isValid ? styles.validPlacementCell : styles.invalidPlacementCell);
                  }
            }

            return (
                  <TouchableOpacity
                        key={`${row}-${col}`}
                        style={cellStyle}
                        onPress={() => onCellPress(row, col)}
                        onMouseEnter={() => setHoverCell({ row, col })}
                        disabled={disabled}
                        activeOpacity={0.7}
                  >
                        {content && <Text style={[contentStyle, { fontSize: cellSize * 0.6 }]}>{content}</Text>}
                  </TouchableOpacity>
            );
      };

      const renderBoardLabels = () => {
            const letters = 'ABCDEFGHIJ';

            return (
                  <View style={styles.boardWithLabels}>
                        {/* Top row with column labels (A-J) */}
                        <View style={styles.labelRow}>
                              <View style={[styles.cornerCell, { width: cellSize, height: cellSize }]} />
                              {Array.from({ length: BOARD_SIZE }).map((_, index) => (
                                    <View
                                          key={`col-${index}`}
                                          style={[styles.labelCell, { width: cellSize, height: cellSize }]}
                                    >
                                          <Text style={[styles.labelText, { fontSize: cellSize * 0.4 }]}>{letters[index]}</Text>
                                    </View>
                              ))}
                        </View>

                        {/* Board with row labels */}
                        <View style={styles.boardWithRowLabels}>
                              {/* Row labels (1-10) */}
                              <View style={styles.rowLabelsColumn}>
                                    {Array.from({ length: BOARD_SIZE }).map((_, index) => (
                                          <View
                                                key={`row-${index}`}
                                                style={[styles.labelCell, { width: cellSize, height: cellSize }]}
                                          >
                                                <Text style={[styles.labelText, { fontSize: cellSize * 0.4 }]}>{index + 1}</Text>
                                          </View>
                                    ))}
                              </View>

                              {/* The actual game board */}
                              <View style={styles.board}>
                                    {Array.from({ length: BOARD_SIZE }).map((_, row) => (
                                          <View
                                                key={`row-${row}`}
                                                style={styles.row}
                                          >
                                                {Array.from({ length: BOARD_SIZE }).map((_, col) => renderCell(row, col))}
                                          </View>
                                    ))}
                              </View>
                        </View>
                  </View>
            );
      };

      return renderBoardLabels();
};

const styles = StyleSheet.create({
      boardWithLabels: {
            alignItems: 'center',
      },
      labelRow: {
            flexDirection: 'row',
            marginBottom: 2,
      },
      boardWithRowLabels: {
            flexDirection: 'row',
      },
      rowLabelsColumn: {
            marginRight: 2,
      },
      labelCell: {
            justifyContent: 'center',
            alignItems: 'center',
      },
      cornerCell: {
            // Size set dynamically
      },
      labelText: {
            fontWeight: 'bold',
            color: '#1e3a8a',
            // Font size set dynamically
      },
      board: {
            borderWidth: 1,
            borderColor: '#1e3a8a',
            backgroundColor: '#bfdbfe',
      },
      row: {
            flexDirection: 'row',
      },
      cell: {
            borderWidth: 0.5,
            borderColor: '#1e3a8a',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#dbeafe',
            // Width and height set dynamically
      },
      shipCell: {
            backgroundColor: '#475569',
      },
      hitCell: {
            backgroundColor: '#dc2626',
      },
      missCell: {
            backgroundColor: '#dbeafe',
      },
      missContent: {
            color: '#1e3a8a',
            // Font size set dynamically
      },
      lastMoveCell: {
            borderWidth: 2,
            borderColor: '#fbbf24',
      },
      validPlacementCell: {
            backgroundColor: 'rgba(21, 128, 61, 0.5)',
      },
      invalidPlacementCell: {
            backgroundColor: 'rgba(220, 38, 38, 0.5)',
      },
});

export default GameBoard;
