import {
  Alert,
  Button,
  Card,
  createStyles,
  Group,
  Input,
  Modal,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconDatabase } from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api";
import { open } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";
import { appDataDir, resolve } from "@tauri-apps/api/path";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  DatabaseInfo,
  getDatabases,
  getDefaultDatabases,
} from "../../utils/db";
import { formatBytes } from "../../utils/format";
import { ProgressButton } from "../common/ProgressButton";

const useStyles = createStyles((theme) => ({
  card: {
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
  },

  title: {
    fontWeight: 700,
    fontFamily: `Greycliff CF, ${theme.fontFamily}`,
    lineHeight: 1.2,
  },

  body: {
    padding: theme.spacing.md,
  },
}));

function AddDatabase({
  databases,
  opened,
  setOpened,
  setLoading,
  setDatabases,
}: {
  databases: DatabaseInfo[];
  opened: boolean;
  setOpened: (opened: boolean) => void;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setDatabases: Dispatch<SetStateAction<DatabaseInfo[]>>;
}) {
  const [defaultdatabases, setDefaultDatabases] = useState<DatabaseInfo[]>([]);
  const [error, setError] = useState(false);

  async function convertDB(path: string, title: string, description?: string) {
    let fileName = path.split(/(\\|\/)/g).pop();
    fileName = fileName?.replace(".pgn", ".ocgdb.db3");
    setLoading(true);
    await invoke("convert_pgn", { file: path, title, description });
    setDatabases(await getDatabases());
    setLoading(false);
  }

  const form = useForm<DatabaseInfo>({
    initialValues: {
      title: "",
      description: "",
      file: "",
      filename: "",
    },

    validate: {
      title: (value) => {
        if (!value) return "Name is required";
        if (databases.find((e) => e.title === value))
          return "Name already used";
      },
      file: (value) => {
        if (!value) return "Path is required";
      },
    },
  });

  useEffect(() => {
    getDefaultDatabases()
      .then((dbs) => {
        setDefaultDatabases(dbs);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Add Database"
    >
      <Tabs defaultValue="web">
        <Tabs.List>
          <Tabs.Tab value="web">Web</Tabs.Tab>
          <Tabs.Tab value="local">Local</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="web" pt="xs">
          <Stack>
            {defaultdatabases.map((engine, i) => (
              <DatabaseCard
                database={engine}
                databaseId={i}
                key={i}
                setDatabases={setDatabases}
                setOpened={setOpened}
                initInstalled={databases.some((e) => e.title === engine.title)}
              />
            ))}
            {error && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Error"
                color="red"
              >
                Failed to fetch the database's info from the server.
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="local" pt="xs">
          <form
            onSubmit={form.onSubmit(async (values) => {
              convertDB(values.file, values.title!, values.description);
              setOpened(false);
            })}
          >
            <TextInput
              label="Title"
              withAsterisk
              {...form.getInputProps("title")}
            />

            <TextInput
              label="Description"
              {...form.getInputProps("description")}
            />

            <Input.Wrapper
              label="PGN file"
              description="Click to select the PGN file"
              withAsterisk
              {...form.getInputProps("path")}
            >
              <Input
                component="button"
                type="button"
                onClick={async () => {
                  const selected = (await open({
                    multiple: false,
                    filters: [
                      {
                        name: "PGN file",
                        extensions: ["pgn", "pgn.zst"],
                      },
                    ],
                  })) as string;
                  form.setFieldValue("file", selected);
                  const filename = selected.split(/(\\|\/)/g).pop();
                  if (filename) {
                    form.setFieldValue("filename", filename);
                  }
                }}
              >
                <Text lineClamp={1}>{form.values.filename}</Text>
              </Input>
            </Input.Wrapper>

            <Button fullWidth mt="xl" type="submit">
              Convert
            </Button>
          </form>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}

function DatabaseCard({
  setDatabases,
  setOpened,
  database,
  databaseId,
  initInstalled,
}: {
  setDatabases: Dispatch<SetStateAction<DatabaseInfo[]>>;
  setOpened: (opened: boolean) => void;
  database: DatabaseInfo;
  databaseId: number;
  initInstalled: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [inProgress, setInProgress] = useState(false);
  const [installed, setInstalled] = useState(initInstalled);

  async function downloadDatabase(id: number, url: string, name: string) {
    setInProgress(true);
    const path = await resolve(await appDataDir(), "db", name + ".db3");
    await invoke("download_file", {
      id,
      url,
      zip: false,
      path,
    });
    setDatabases(await getDatabases());
    setInProgress(false);
    setOpened(false);
  }

  useEffect(() => {
    async function getDatabaseProgress() {
      const unlisten = await listen("download_progress", async (event) => {
        const { progress, id, finished } = event.payload as any;
        if (id !== databaseId) return;
        if (finished) {
          setInstalled(true);
          unlisten();
        } else {
          setProgress(progress);
        }
      });
    }
    getDatabaseProgress();
  }, []);

  const { classes } = useStyles();

  return (
    <Card
      withBorder
      radius="md"
      p={0}
      key={database.title}
      className={classes.card}
    >
      <Group noWrap spacing={0} grow>
        <div className={classes.body}>
          <Text transform="uppercase" color="dimmed" weight={700} size="xs">
            DATABASE
          </Text>
          <Text className={classes.title} mb="xs">
            {database.title}
          </Text>
          <Group noWrap spacing="xs" mb="xs">
            <IconDatabase size={16} />
            <Text size="xs">{formatBytes(database.storage_size!)}</Text>
          </Group>
          <ProgressButton
            loaded={installed}
            onClick={() =>
              downloadDatabase(
                databaseId,
                database.downloadLink!,
                database.title!
              )
            }
            progress={progress}
            id={databaseId}
            disabled={installed || inProgress}
          />
        </div>
      </Group>
    </Card>
  );
}

export default AddDatabase;