
import { Meta, StoryObj } from "@storybook/react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "./tooltip"

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "error", "warning", "info"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg"],
    },
    side: {
      control: "select",
      options: ["top", "right", "bottom", "left"],
    },
    align: {
      control: "select",
      options: ["start", "center", "end"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  args: {
    content: "This is a tooltip",
    children: <Button>Hover me</Button>,
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tooltip content="Default tooltip">
        <Button variant="outline">Default</Button>
      </Tooltip>
      <Tooltip content="Success message" variant="success">
        <Button variant="outline">Success</Button>
      </Tooltip>
      <Tooltip content="Error message" variant="error">
        <Button variant="outline">Error</Button>
      </Tooltip>
      <Tooltip content="Warning message" variant="warning">
        <Button variant="outline">Warning</Button>
      </Tooltip>
      <Tooltip content="Info message" variant="info">
        <Button variant="outline">Info</Button>
      </Tooltip>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tooltip content="Small tooltip" size="sm">
        <Button variant="outline">Small</Button>
      </Tooltip>
      <Tooltip content="Default tooltip" size="default">
        <Button variant="outline">Default</Button>
      </Tooltip>
      <Tooltip content="Large tooltip" size="lg">
        <Button variant="outline">Large</Button>
      </Tooltip>
    </div>
  ),
}

export const Positions: Story = {
  render: () => (
    <div className="flex gap-4">
      <Tooltip content="Top tooltip" side="top">
        <Button variant="outline">Top</Button>
      </Tooltip>
      <Tooltip content="Right tooltip" side="right">
        <Button variant="outline">Right</Button>
      </Tooltip>
      <Tooltip content="Bottom tooltip" side="bottom">
        <Button variant="outline">Bottom</Button>
      </Tooltip>
      <Tooltip content="Left tooltip" side="left">
        <Button variant="outline">Left</Button>
      </Tooltip>
    </div>
  ),
}