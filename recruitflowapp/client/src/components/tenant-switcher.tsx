import React from "react";
import { Building, CheckIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTenant } from "@/hooks/use-tenant";
import { Company } from "@shared/schema";

export function TenantSwitcher() {
  const { availableTenants, currentTenant, switchTenant } = useTenant();
  const [open, setOpen] = React.useState(false);

  if (!currentTenant || availableTenants.length <= 1) {
    // If no tenant or only one tenant, don't show switcher
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select a tenant"
          className="w-[200px] justify-between"
        >
          <Building className="mr-2 h-4 w-4" />
          <span className="truncate">{currentTenant.name}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search tenant..." />
          <CommandEmpty>No tenant found.</CommandEmpty>
          <CommandGroup>
            {availableTenants.map((tenant: Company) => (
              <CommandItem
                key={tenant.id}
                value={tenant.name}
                onSelect={() => {
                  switchTenant(tenant.id);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Building className="mr-2 h-4 w-4" />
                <span className="truncate">{tenant.name}</span>
                {currentTenant.id === tenant.id && (
                  <CheckIcon className="ml-auto h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}