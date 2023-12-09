import {
  Button,
  Center,
  Checkbox,
  Image,
  Group,
  Stack,
  Text,
  Paper,
  Collapse,
} from "@mantine/core";
import { useToggle } from "@mantine/hooks";
import { IconCloud, IconRobot, IconSettings } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { memo } from "react";
import { Engine, stopEngine } from "@/utils/engines";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useAtom, useAtomValue } from "jotai";
import { activeTabAtom, enginesAtom } from "@/atoms/atoms";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import useSWRImmutable from "swr/immutable";

function EngineBox({
  engine,
  toggleEnabled,
}: {
  engine: Engine;
  toggleEnabled: () => void;
}) {
  const activeTab = useAtomValue(activeTabAtom);

  const { data: imageSrc } = useSWRImmutable(engine.image, async (image) => {
    if (image && image.startsWith("http")) {
      return image;
    } else if (image) {
      return await convertFileSrc(image);
    }
  });

  return (
    <Paper
      withBorder
      p="sm"
      w="16rem"
      mb="xs"
      h="4rem"
      onClick={() => {
        if (engine.loaded && engine.type === "local") {
          stopEngine(engine, activeTab!);
        }
        toggleEnabled();
      }}
      style={{ cursor: "pointer" }}
    >
      <Group>
        <Checkbox checked={engine.loaded} />
        {imageSrc ? (
          <Image src={imageSrc} alt={engine.name} h="2.5rem" />
        ) : engine.type !== "local" ? (
          <IconCloud size="2rem" />
        ) : (
          <IconRobot size="2rem" />
        )}
        <Text>{engine.name}</Text>
      </Group>
    </Paper>
  );
}

function EngineSelection() {
  const [showSettings, toggleShowSettings] = useToggle();
  const [engines, setEngines] = useAtom(enginesAtom);

  return (
    <>
      <Button
        variant="default"
        onClick={() => {
          toggleShowSettings();
        }}
        leftSection={<IconSettings size="0.875rem" />}
      >
        Manage Engines
      </Button>
      <Collapse title="Engine Selection" in={showSettings}>
        {engines.length === 0 && (
          <Center>
            <Text>
              No engines installed. Please{" "}
              <Link to="/engines">Add an engine</Link> first.
            </Text>
          </Center>
        )}

        <DragDropContext
          onDragEnd={({ destination, source }) =>
            destination?.index !== undefined &&
            setEngines(async (prev) => {
              const result = Array.from(await prev);
              const [removed] = result.splice(source.index, 1);
              result.splice(destination.index, 0, removed);
              return result;
            })
          }
        >
          <Droppable droppableId="droppable" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                <Stack gap={0} align="center">
                  {engines.map((engine, i) => (
                    <Draggable
                      key={engine.name}
                      draggableId={engine.name}
                      index={i}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <EngineBox
                            key={engine.name}
                            engine={engine}
                            toggleEnabled={() => {
                              setEngines(async (prev) =>
                                (await prev).map((e) =>
                                  e.name === engine.name
                                    ? { ...e, loaded: !e.loaded }
                                    : e
                                )
                              );
                            }}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </Stack>

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </Collapse>
    </>
  );
}

export default memo(EngineSelection);
